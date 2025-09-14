# Echo Voice Assistant

<div align="center">
  <img src="./logo.png" alt="Echo Voice Assistant Logo" width="200" height="200">
</div>

## Demo Video

<div>
    <a href="https://www.loom.com/share/858ad074a495404cab1b1c9a8c7a6144">
      <p>echo - Watch Video</p>
    </a>
    <a href="https://www.loom.com/share/858ad074a495404cab1b1c9a8c7a6144">
      <img style="max-width:300px;" src="https://cdn.loom.com/sessions/thumbnails/858ad074a495404cab1b1c9a8c7a6144-982f0ea5b05259b9-full-play.gif">
    </a>
  </div>

## echo (echo)

Keyboard and mouse sucks. Our (human) brains are build to use natural language. Clicking 'start agent' button is the last thing you need to do. Then just speak to your computer.

Run livekit agents locally and configure them with any mcp servers.

You can configure your own local voice agents by changing system prompts and configuring mcps. Run the agent in cli for more control.

Running in cli recommended. Errors may pop up, then feel free to contribute and fix them. MCP integration was inspired by [livekit example](https://github.com/livekit-examples/basic-mcp) and adjusted to work also with non-realtime models.

🌐 **[echo webside](https://echo-craft-voice.lovable.app/)**

## Important notes

- it works, and it's quite fun, but requires some manuall configuration (sometimes for mcps)
- coded couple of hours
- could be unsafe to run 😂
- significant part written by llm's

## Architecture

Echo is built with a hybrid **Electron + Python** architecture:

- **Frontend**: Electron app (React/TypeScript) for the user interface
- **Backend**: Python agent using UV package manager for AI processing and MCP server integrations
- **Communication**: The Electron app spawns and communicates with the Python backend process
- **Audio Processing**: Handled directly by the Python process for voice input/output
- **MCP Integration**: Python backend handles Model Context Protocol servers for extended functionality

This setup allows for a responsive desktop UI while leveraging Python's rich AI ecosystem for voice processing and LLM interactions.

## Requirements

- **Node.js**: Version 18.x or higher
- **Python**: Version 3.12 or higher
- **uv**: Python package manager

## How to Run the App

1. **Install dependencies:**

   ```bash
   cd electron && npm install
   cd ../agent && uv sync
   ```

2. **Start development:**
   ```bash
   cd electron && npm run dev
   ```

## How to Run the Agent in CLI

For more control and debugging, you can run the agent directly from the command line:

1. **Set up environment variables:**

   ```bash
   export DEEPGRAM_API_KEY="your_deepgram_api_key"
   export CARTESIA_API_KEY="your_cartesia_api_key"
   export OPENAI_API_KEY="your_openai_api_key"
   export ACI_API_KEY="your_aci_api_key"  # Optional, for ACI MCP server
   ```

2. **Navigate to the agent directory:**

   ```bash
   cd agent
   ```

3. **Run the agent:**
   ```bash
   uv run -m src.ctsm.main console
   ```

This will start the LiveKit agent in console mode. The agent will connect to LiveKit Cloud by default, or you can configure it to connect to your own LiveKit server.

## How to Build the App

```bash
cd electron
npm run package        # Build everything and create installer
npm run dist           # Create distributable packages
npm run dist:mac-arm64 # Build for macOS ARM64 specifically
```

## How to Configure Servers and MCPs

All API keys and server configurations can be set directly in the app's settings interface after running the application. No manual configuration files needed!
