import { useState, useEffect } from "react";
import {
  Mic,
  Settings,
  Lock,
  User,
  Play,
  Square,
  Trash2,
  Plus,
  ArrowLeft,
  Save,
  ChevronDown,
  MoreVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
interface Config {
  secrets?: {
    openaiApiKey?: string;
    deepgramApiKey?: string;
    cartesiaApiKey?: string;
    aciApiKey?: string;
  };
  systemPrompt?: string;
  userContext?: {
    name?: string;
    preferences?: string;
    additionalInfo?: string;
  };
  mcpServers?: McpServer[];
  agentProfiles?: Record<string, AgentProfile>;
  currentAgentProfile?: string;
}

interface McpServer {
  name: string;
  command: string;
  args: string[];
}

interface AgentProfile {
  systemPrompt?: string;
  mcpServers?: McpServer[];
}

// Declare electron API
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}

function App() {
  const [activeTab, setActiveTab] = useState("agents");
  const [config, setConfig] = useState<Config>({});
  const [status, setStatus] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const [output, setOutput] = useState("");
  const [currentEditingAgent, setCurrentEditingAgent] = useState<string | null>(
    null,
  );
  const [showAgentEdit, setShowAgentEdit] = useState(false);
  const [showAgentRun, setShowAgentRun] = useState(false);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [isButtonHovered, setIsButtonHovered] = useState(false);
  const [editAgentName, setEditAgentName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);

  // Load configuration on startup
  useEffect(() => {
    loadConfig();

    // Set up Python output listeners
    if (window.electronAPI) {
      window.electronAPI.on("python-output", (data: any) => {
        let outputText = "";

        // Skip IPC wrapper objects that contain sender information
        if (data && typeof data === "object" && data.sender) {
          return;
        }

        if (typeof data === "string") {
          outputText = data.trim();
        } else if (Buffer.isBuffer(data)) {
          outputText = data.toString().trim();
        } else if (data && typeof data === "object") {
          // Handle structured log data
          if (data.message) {
            outputText = data.message;
          } else if (data.text) {
            outputText = data.text;
          } else {
            // For debugging - let's see what we're actually getting
            console.log("Received object data:", data);
            outputText = JSON.stringify(data, null, 2);
          }
        } else {
          outputText = String(data);
        }

        // Only add non-empty logs
        if (outputText && outputText.trim()) {
          // Add timestamp for better log tracking
          const timestamp = new Date().toLocaleTimeString();
          setOutput((prev) => prev + `[${timestamp}] ${outputText}\n`);
        }
      });

      window.electronAPI.on("python-error", (data: any) => {
        let errorText = "";

        // Skip IPC wrapper objects that contain sender information
        if (data && typeof data === "object" && data.sender) {
          return;
        }

        if (typeof data === "string") {
          errorText = data.trim();
        } else if (data && typeof data === "object") {
          if (data.message) {
            errorText = data.message;
          } else if (data.error) {
            errorText = data.error;
          } else {
            errorText = JSON.stringify(data, null, 2);
          }
        } else {
          errorText = String(data);
        }

        // Only add non-empty errors
        if (errorText && errorText.trim()) {
          // Add timestamp and ERROR prefix for errors
          const timestamp = new Date().toLocaleTimeString();
          setOutput((prev) => prev + `[${timestamp}] ERROR: ${errorText}\n`);
        }
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners("python-output");
        window.electronAPI.removeAllListeners("python-error");
      }
    };
  }, []);

  const loadConfig = async () => {
    try {
      if (window.electronAPI) {
        const loadedConfig = await window.electronAPI.invoke("get-config");
        setConfig(loadedConfig);
        setSystemPrompt(loadedConfig.systemPrompt || "");
        setMcpServers(loadedConfig.mcpServers || []);
      }
    } catch (error) {
      showStatus("Failed to load configuration", "error");
    }
  };

  const showStatus = (message: string, type: "success" | "error") => {
    setStatus({ message, type });
    setTimeout(() => setStatus(null), 5000);
  };

  const saveSecrets = async () => {
    try {
      const secretsConfig = {
        secrets: {
          openaiApiKey:
            (document.getElementById("openaiApiKey") as HTMLInputElement)
              ?.value || "",
          deepgramApiKey:
            (document.getElementById("deepgramApiKey") as HTMLInputElement)
              ?.value || "",
          cartesiaApiKey:
            (document.getElementById("cartesiaApiKey") as HTMLInputElement)
              ?.value || "",
          aciApiKey:
            (document.getElementById("aciApiKey") as HTMLInputElement)?.value ||
            "",
        },
      };

      if (window.electronAPI) {
        await window.electronAPI.invoke("save-config", secretsConfig);
        setConfig((prev) => ({ ...prev, ...secretsConfig }));
        showStatus("Secrets saved successfully!", "success");
      }
    } catch (error) {
      showStatus("Failed to save secrets", "error");
    }
  };

  const saveUser = async () => {
    try {
      const userConfig = {
        userContext: {
          name:
            (document.getElementById("userName") as HTMLInputElement)?.value ||
            "",
          preferences:
            (document.getElementById("userPreferences") as HTMLTextAreaElement)
              ?.value || "",
          additionalInfo:
            (document.getElementById("additionalInfo") as HTMLTextAreaElement)
              ?.value || "",
        },
      };

      if (window.electronAPI) {
        await window.electronAPI.invoke("save-config", userConfig);
        setConfig((prev) => ({ ...prev, ...userConfig }));
        showStatus("User settings saved successfully!", "success");
      }
    } catch (error) {
      showStatus("Failed to save user settings", "error");
    }
  };

  const startAgent = async () => {
    try {
      if (window.electronAPI && currentEditingAgent) {
        // Get the current agent's configuration
        const agentProfile = config.agentProfiles?.[currentEditingAgent];
        const agentConfig = {
          systemPrompt: agentProfile?.systemPrompt || systemPrompt,
          mcpServers: agentProfile?.mcpServers || mcpServers,
        };

        console.log("Starting agent with config:", {
          agent: currentEditingAgent,
          systemPrompt: agentConfig.systemPrompt?.substring(0, 100) + "...",
          mcpServersCount: agentConfig.mcpServers?.length || 0,
        });

        const result = await window.electronAPI.invoke(
          "start-agent",
          agentConfig,
        );
        if (result.success) {
          setIsAgentRunning(true);
        }
      }
    } catch (error) {
      console.error("Failed to start agent", error);
    }
  };

  const stopAgent = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.invoke("stop-agent");
        if (result.success) {
          setIsAgentRunning(false);
        }
      }
    } catch (error) {
      console.error("Failed to stop agent", error);
    }
  };

  const clearOutput = () => {
    setOutput("");
  };

  const scrollToBottom = () => {
    const outputElement = document.getElementById("output");
    if (outputElement) {
      outputElement.scrollTop = outputElement.scrollHeight;
    }
  };

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (output) {
      setTimeout(() => {
        scrollToBottom();
      }, 100);
    }
  }, [output]);

  const addMcpServer = () => {
    setMcpServers((prev) => [
      ...prev,
      { name: "New MCP Server", command: "", args: [] },
    ]);
  };

  const updateMcpServer = (
    index: number,
    field: keyof McpServer,
    value: string | string[],
  ) => {
    setMcpServers((prev) =>
      prev.map((server, i) =>
        i === index ? { ...server, [field]: value } : server,
      ),
    );
  };

  const removeMcpServer = (index: number) => {
    setMcpServers((prev) => prev.filter((_, i) => i !== index));
  };

  const addNewAgent = () => {
    setCurrentEditingAgent(null);
    setEditAgentName("");
    setSystemPrompt("");
    setMcpServers([]);
    setShowAgentEdit(true);
    setShowAgentRun(false);
  };

  const backToList = () => {
    setShowAgentEdit(false);
    setShowAgentRun(false);
    setCurrentEditingAgent(null);
  };

  const runAgent = (profileName: string) => {
    const profiles = config.agentProfiles || {};
    const profile = profiles[profileName];

    if (profile) {
      setCurrentEditingAgent(profileName);
      setShowAgentRun(true);
      setShowAgentEdit(false);
    }
  };

  const editAgent = (profileName: string) => {
    const profiles = config.agentProfiles || {};
    const profile = profiles[profileName];

    if (profile) {
      setCurrentEditingAgent(profileName);
      setEditAgentName(profileName);
      setSystemPrompt(profile.systemPrompt || "");
      setMcpServers(profile.mcpServers || []);
      setShowAgentEdit(true);
      setShowAgentRun(false);
    }
  };

  const saveAgentConfig = async () => {
    if (!editAgentName.trim()) {
      showStatus("Please enter an agent name", "error");
      return;
    }

    const profileData = {
      systemPrompt,
      mcpServers,
    };

    try {
      let profiles = { ...(config.agentProfiles || {}) };

      // If editing existing agent and name changed, delete old one
      if (currentEditingAgent && currentEditingAgent !== editAgentName) {
        delete profiles[currentEditingAgent];
      }

      profiles[editAgentName] = profileData;
      const newConfig = { agentProfiles: profiles };

      if (window.electronAPI) {
        await window.electronAPI.invoke("save-config", newConfig);
        setConfig((prev) => ({ ...prev, ...newConfig }));
        setShowAgentEdit(false);
        showStatus(`Agent "${editAgentName}" saved successfully!`, "success");
      }
    } catch (error) {
      showStatus("Failed to save agent configuration", "error");
    }
  };

  const deleteAgent = async (profileName: string) => {
    if (profileName === "default") {
      showStatus("Cannot delete default agent", "error");
      return;
    }

    if (
      confirm(`Are you sure you want to delete the agent "${profileName}"?`)
    ) {
      try {
        const profiles = { ...config.agentProfiles };
        delete profiles[profileName];

        const newConfig = { agentProfiles: profiles };

        if (window.electronAPI) {
          await window.electronAPI.invoke("save-config", newConfig);
          setConfig((prev) => ({ ...prev, ...newConfig }));
          showStatus(`Agent "${profileName}" deleted successfully`, "success");
        }
      } catch (error) {
        showStatus("Failed to delete agent", "error");
      }
    }
  };

  const formatAgentName = (profileName: string) => {
    // Convert kebab-case to Title Case
    if (profileName === "hacker-news-agent") {
      return "Hacker News Agent";
    }
    return profileName
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const renderAgentList = () => {
    const profiles = config.agentProfiles || {};
    const profileNames = Object.keys(profiles);

    if (profileNames.length === 0) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <h4 className="text-lg font-semibold mb-2">No agents configured</h4>
            <p className="text-muted-foreground text-center">
              Click "Add New Agent" to create your first agent configuration
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {profileNames.map((profileName) => {
          const profile = profiles[profileName];
          const promptPreview = profile.systemPrompt
            ? profile.systemPrompt.substring(0, 100) +
              (profile.systemPrompt.length > 100 ? "..." : "")
            : "No system prompt configured";
          const mcpCount = profile.mcpServers ? profile.mcpServers.length : 0;

          return (
            <Card
              key={profileName}
              className="hover:shadow-lg transition-all duration-300 cursor-pointer relative border-0"
              style={{
                background:
                  "linear-gradient(135deg, rgba(0,97,255,0.05) 0%, rgba(96,239,255,0.05) 100%)",
                border: "1px solid rgba(0,97,255,0.1)",
              }}
              onClick={() => runAgent(profileName)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {formatAgentName(profileName)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {promptPreview}
                    </CardDescription>
                    <p className="text-sm text-muted-foreground mt-2">
                      {mcpCount} MCP server{mcpCount !== 1 ? "s" : ""}{" "}
                      configured
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          editAgent(profileName);
                        }}
                      >
                        <Settings className="w-4 h-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      {profileName !== "default" && (
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteAgent(profileName);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    );
  };

  const tabs = [
    { id: "agents", label: "Agents", icon: Mic },
    { id: "secrets", label: "Secrets", icon: Lock },
    { id: "user", label: "User", icon: User },
  ];

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className="w-64 text-white flex-shrink-0"
        style={{
          background: "linear-gradient(180deg, #0061ff 0%, #60efff 100%)",
        }}
      >
        <nav className="mt-20">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-6 py-3 text-left transition-colors ${
                  activeTab === tab.id
                    ? "bg-white bg-opacity-20 text-white backdrop-blur-sm"
                    : "text-blue-100 hover:bg-white hover:bg-opacity-10"
                }`}
              >
                <Icon className="w-5 h-5" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header
          className="border-b px-6 py-4"
          style={{
            background: "#0061ff",
            WebkitAppRegion: "drag",
          }}
        >
          <h2
            className="text-2xl font-semibold text-white"
            style={{ WebkitAppRegion: "drag" }}
          >
            {tabs.find((tab) => tab.id === activeTab)?.label}
          </h2>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Agents Tab */}
          {activeTab === "agents" && (
            <div className="flex flex-col h-full">
              {!showAgentEdit && !showAgentRun ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Agent Configurations</CardTitle>
                      <Button
                        onClick={addNewAgent}
                        className="text-white border-0"
                        style={{
                          background:
                            "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
                        }}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Agent
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>{renderAgentList()}</CardContent>
                </Card>
              ) : showAgentEdit ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex gap-2 mb-4">
                        <Button onClick={backToList} variant="outline">
                          <ArrowLeft className="w-4 h-4 mr-2" />
                          Back to List
                        </Button>
                        <Button
                          onClick={saveAgentConfig}
                          className="text-white border-0"
                          style={{
                            background:
                              "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
                          }}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Save Agent
                        </Button>
                      </div>
                      <CardTitle>
                        {currentEditingAgent
                          ? `Editing: ${currentEditingAgent}`
                          : "Add New Agent"}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div>
                        <Label htmlFor="agentName">Agent Name:</Label>
                        <Input
                          id="agentName"
                          value={editAgentName}
                          onChange={(e) => setEditAgentName(e.target.value)}
                          placeholder="e.g., Customer Support Assistant"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>System Prompt</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                        placeholder="Enter your system prompt here..."
                        className="min-h-[150px]"
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>MCP Servers</CardTitle>
                      <Button onClick={addMcpServer} variant="outline">
                        <Plus className="w-4 h-4 mr-2" />
                        Add MCP Server
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {mcpServers.map((server, index) => (
                        <Card key={index} className="p-4">
                          <div className="space-y-3">
                            <div>
                              <Label>Server Name:</Label>
                              <Input
                                value={server.name}
                                onChange={(e) =>
                                  updateMcpServer(index, "name", e.target.value)
                                }
                              />
                            </div>
                            <div>
                              <Label>Command:</Label>
                              <Input
                                value={server.command}
                                onChange={(e) =>
                                  updateMcpServer(
                                    index,
                                    "command",
                                    e.target.value,
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label>Arguments (JSON array):</Label>
                              <Input
                                value={JSON.stringify(server.args)}
                                onChange={(e) => {
                                  try {
                                    updateMcpServer(
                                      index,
                                      "args",
                                      JSON.parse(e.target.value),
                                    );
                                  } catch (error) {
                                    // Handle invalid JSON
                                  }
                                }}
                              />
                            </div>
                            <Button
                              onClick={() => removeMcpServer(index)}
                              variant="destructive"
                              size="sm"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              ) : showAgentRun ? (
                <div className="flex flex-col h-full">
                  {/* Header with agent name and controls */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <Button
                        onClick={backToList}
                        variant="outline"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Back to List
                      </Button>
                      <Button
                        onClick={() => setShowLogs(!showLogs)}
                        variant="outline"
                        size="sm"
                        className="border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        {showLogs ? (
                          <EyeOff className="w-4 h-4 mr-2" />
                        ) : (
                          <Eye className="w-4 h-4 mr-2" />
                        )}
                        {showLogs ? "Hide Logs" : "Show Logs"}
                      </Button>
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900">
                      {currentEditingAgent
                        ? formatAgentName(currentEditingAgent)
                        : ""}
                    </h1>
                  </div>

                  {/* Middle content area */}
                  <div className="flex-1 flex items-center justify-center mb-6">
                    {isAgentRunning && !showLogs ? (
                      /* Cool animation when agent is running */
                      <div className="flex flex-col items-center space-y-8">
                        <div className="relative">
                          {/* Outer pulsing ring */}
                          <div
                            className="absolute inset-0 opacity-20 animate-ping"
                            style={{ backgroundColor: "#60efff" }}
                          ></div>
                          <div
                            className="absolute inset-2 opacity-30 animate-pulse"
                            style={{ backgroundColor: "#0061ff" }}
                          ></div>

                          {/* Main square with wave animation */}
                          <div
                            className="relative w-32 h-32 flex items-center justify-center overflow-hidden"
                            style={{
                              background:
                                "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
                            }}
                          >
                            <div
                              className="absolute inset-0 opacity-60"
                              style={{
                                background:
                                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)",
                                backgroundSize: "200% 100%",
                                animation: "wave 2s ease-in-out infinite",
                              }}
                            ></div>
                            <div className="relative z-10 w-4 h-4 bg-white animate-pulse"></div>
                          </div>
                        </div>

                        {/* Status text */}
                        <div className="text-center">
                          <h3 className="text-xl font-semibold mb-2 text-slate-700">
                            Agent is Running
                          </h3>
                          <p className="text-blue-400 animate-pulse">
                            Processing your requests...
                          </p>
                        </div>
                      </div>
                    ) : showLogs ? (
                      /* Logs section (if visible) */
                      <Card className="w-full h-full">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle>Agent Logs</CardTitle>
                            <div className="flex gap-2">
                              <Button
                                onClick={clearOutput}
                                variant="outline"
                                size="sm"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Clear
                              </Button>
                              <Button
                                onClick={scrollToBottom}
                                variant="outline"
                                size="sm"
                              >
                                <ChevronDown className="w-4 h-4 mr-2" />
                                Scroll to Bottom
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1">
                          <div
                            id="output"
                            className="bg-slate-900 text-green-400 font-mono p-4 h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed"
                            style={{
                              scrollBehavior: "smooth",
                            }}
                          >
                            {output || (
                              <div className="text-slate-500 italic">
                                Python agent logs will appear here when the
                                agent is running...
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ) : (
                      /* Empty state when agent is not running and logs are hidden */
                      <div className="text-center text-blue-400">
                        <div
                          className="w-24 h-24 mx-auto mb-4 flex items-center justify-center"
                          style={{
                            background:
                              "linear-gradient(135deg, rgba(0,97,255,0.1) 0%, rgba(96,239,255,0.1) 100%)",
                          }}
                        >
                          <Play className="w-8 h-8 text-blue-500" />
                        </div>
                        <p>Click the button below to start the agent</p>
                      </div>
                    )}
                  </div>

                  {/* Spacer to push button to bottom */}
                  <div className="flex-1"></div>

                  {/* Full-width animated run button at bottom */}
                  <div className="mt-auto">
                    <Button
                      onClick={isAgentRunning ? stopAgent : startAgent}
                      onMouseEnter={() => setIsButtonHovered(true)}
                      onMouseLeave={() => setIsButtonHovered(false)}
                      className="w-full h-16 text-lg font-semibold transition-colors duration-300 relative overflow-hidden text-white"
                      style={{
                        background: isAgentRunning
                          ? isButtonHovered
                            ? "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"
                            : "linear-gradient(135deg, #dc2626 0%, #f87171 100%)"
                          : "linear-gradient(135deg, #0061ff 0%, #60efff 100%)",
                      }}
                    >
                      {/* Wave animation background - always present to prevent layout shift */}
                      <div className="absolute inset-0 opacity-40">
                        <div
                          className="absolute inset-0"
                          style={{
                            background: isAgentRunning
                              ? "linear-gradient(90deg, #dc2626 0%, #ef4444 25%, #dc2626 50%, #ef4444 75%, #dc2626 100%)"
                              : "linear-gradient(90deg, #0061ff 0%, #60efff 25%, #0061ff 50%, #60efff 75%, #0061ff 100%)",
                            backgroundSize: "200% 100%",
                            animation:
                              isAgentRunning && !isButtonHovered
                                ? "wave 2s ease-in-out infinite"
                                : "none",
                            opacity: isAgentRunning && !isButtonHovered ? 1 : 0,
                            transition: "opacity 0.3s ease",
                          }}
                        ></div>
                      </div>

                      {/* Button content - fixed width to prevent jumping */}
                      <div className="relative z-10 flex items-center justify-center gap-3 min-w-0">
                        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
                          {isAgentRunning ? (
                            isButtonHovered ? (
                              <Square className="w-6 h-6" />
                            ) : (
                              <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                            )
                          ) : (
                            <Play className="w-6 h-6" />
                          )}
                        </div>
                        <span className="flex-shrink-0 min-w-[120px] text-center">
                          {isAgentRunning
                            ? isButtonHovered
                              ? "Click to Stop"
                              : "Running..."
                            : "Start Agent"}
                        </span>
                      </div>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Secrets Tab */}
          {activeTab === "secrets" && (
            <Card>
              <CardHeader>
                <CardTitle>API Keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="openaiApiKey">OpenAI API Key:</Label>
                    <Input
                      id="openaiApiKey"
                      type="password"
                      defaultValue={config.secrets?.openaiApiKey || ""}
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="deepgramApiKey">Deepgram API Key:</Label>
                    <Input
                      id="deepgramApiKey"
                      type="password"
                      defaultValue={config.secrets?.deepgramApiKey || ""}
                      placeholder="Your Deepgram API key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cartesiaApiKey">Cartesia API Key:</Label>
                    <Input
                      id="cartesiaApiKey"
                      type="password"
                      defaultValue={config.secrets?.cartesiaApiKey || ""}
                      placeholder="Your Cartesia API key"
                    />
                  </div>
                  <div>
                    <Label htmlFor="aciApiKey">ACI API Key:</Label>
                    <Input
                      id="aciApiKey"
                      type="password"
                      defaultValue={config.secrets?.aciApiKey || ""}
                      placeholder="Your ACI API key"
                    />
                  </div>
                </div>
                <Button onClick={saveSecrets}>
                  <Save className="w-4 h-4 mr-2" />
                  Save Secrets
                </Button>
              </CardContent>
            </Card>
          )}

          {/* User Tab */}
          {activeTab === "user" && (
            <Card>
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="userName">Your Name:</Label>
                  <Input
                    id="userName"
                    defaultValue={config.userContext?.name || ""}
                    placeholder="e.g., John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="userPreferences">Preferences:</Label>
                  <Textarea
                    id="userPreferences"
                    defaultValue={config.userContext?.preferences || ""}
                    placeholder="e.g., I prefer brief responses, I'm a software developer..."
                  />
                </div>
                <div>
                  <Label htmlFor="additionalInfo">Additional Context:</Label>
                  <Textarea
                    id="additionalInfo"
                    defaultValue={config.userContext?.additionalInfo || ""}
                    placeholder="Any other context the AI should know about you..."
                  />
                </div>
                <Button onClick={saveUser}>
                  <Save className="w-4 h-4 mr-2" />
                  Save User Settings
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
