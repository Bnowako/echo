const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const Store = require("electron-store");
const { defaultAgents } = require("./defaultAgents");

// Configuration store
const store = new Store({
  defaults: {
    secrets: {
      openaiApiKey: "",
      deepgramApiKey: "",
      cartesiaApiKey: "",
      aciApiKey: "",
    },
    userContext: {
      name: "",
      preferences: "",
      additionalInfo: "",
    },
    agentProfiles: defaultAgents,
  },
});

let mainWindow;
let pythonProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "assets/icons/icon.png"), // Add your icon here
    titleBarStyle: "hiddenInset",
    titleBarOverlay: {
      color: "#0061ff",
      symbolColor: "#ffffff",
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  const isDev = process.argv.includes("--dev") || !app.isPackaged;

  if (isDev) {
    // In development, load from Vite dev server
    mainWindow.loadURL("http://localhost:5174");
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from built files
    mainWindow.loadFile(path.join(__dirname, "dist-renderer/index.html"));
  }
}

function startPythonBackend() {
  // Better development detection
  const isDev = process.argv.includes("--dev") || !app.isPackaged;
  const pythonPath = isDev
    ? path.join(__dirname, "../agent")
    : path.join(process.resourcesPath, "python");

  const config = store.store;

  // Prepare configuration JSON to pass to Python
  const configJson = JSON.stringify(config);

  console.log("Starting Python backend with config:", {
    isDev: isDev,
    pythonPath: pythonPath,
    userContext: config.userContext,
    hasSecrets: Object.keys(config.secrets || {}).length > 0,
    mcpServers: config.mcpServers?.length || 0,
  });

  if (isDev) {
    // In development, use the same approach as manual: uv run -m
    const env = {
      ...process.env,
      PYTHONPATH: path.join(pythonPath, "src"),
      LIVEKIT_CONSOLE_DISABLE_STDIN: "1",
    };

    pythonProcess = spawn(
      "uv",
      [
        "run",
        "--env-file",
        ".env",
        "-m",
        "src.ctsm.electron_main",
        "console",
        configJson,
      ],
      {
        cwd: pythonPath,
        env: env,
        stdio: "pipe",
      },
    );
  } else {
    // In production, use the bundled executable
    const execName =
      process.platform === "win32" ? "ctsm-agent.exe" : "ctsm-agent";
    const execPath = path.join(pythonPath, execName);

    pythonProcess = spawn(execPath, ["console", configJson], {
      stdio: "pipe",
    });
  }

  pythonProcess.stdout.on("data", (data) => {
    console.log(`Python stdout: ${data}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("python-output", data.toString());
    }
  });

  pythonProcess.stderr.on("data", (data) => {
    console.error(`Python stderr: ${data}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("python-error", data.toString());
    }
  });

  pythonProcess.on("close", (code) => {
    console.log(`Python process exited with code ${code}`);
    pythonProcess = null;
  });
}

// IPC handlers for configuration management
ipcMain.handle("get-config", () => {
  return store.store;
});

ipcMain.handle("save-config", (event, newConfig) => {
  store.store = { ...store.store, ...newConfig };
  return true;
});

ipcMain.handle("load-env-secrets", () => {
  const isDev = process.argv.includes("--dev") || !app.isPackaged;
  if (!isDev) {
    return {
      success: false,
      message: "Environment file only available in development mode",
    };
  }

  try {
    const envPath = path.join(__dirname, "../agent/.env");
    const fs = require("fs");

    if (!fs.existsSync(envPath)) {
      return {
        success: false,
        message: ".env file not found in agent directory",
      };
    }

    const envContent = fs.readFileSync(envPath, "utf8");
    const envVars = {};

    envContent.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          envVars[key] = valueParts.join("=");
        }
      }
    });

    const secrets = {
      openaiApiKey: envVars.OPENAI_API_KEY || "",
      deepgramApiKey: envVars.DEEPGRAM_API_KEY || "",
      cartesiaApiKey: envVars.CARTESIA_API_KEY || "",
      aciApiKey: envVars.ACI_API_KEY || "",
    };

    return { success: true, secrets };
  } catch (error) {
    console.error("Error loading .env file:", error);
    return { success: false, message: "Failed to read .env file" };
  }
});

ipcMain.handle("start-agent", (event, agentConfig) => {
  if (!pythonProcess) {
    // If agent config is provided, temporarily update the store with it
    if (agentConfig) {
      const currentConfig = store.store;
      const tempConfig = {
        ...currentConfig,
        systemPrompt: agentConfig.systemPrompt || currentConfig.systemPrompt,
        mcpServers: agentConfig.mcpServers || currentConfig.mcpServers,
      };
      // Temporarily store the agent config for this session
      store.set(tempConfig);
    }
    startPythonBackend();
    return { success: true, message: "Agent started" };
  }
  return { success: false, message: "Agent already running" };
});

ipcMain.handle("stop-agent", () => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
    return { success: true, message: "Agent stopped" };
  }
  return { success: false, message: "Agent not running" };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
