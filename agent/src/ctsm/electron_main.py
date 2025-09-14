import asyncio
import json
import logging
import os
import sys
from typing import Any, Dict

from livekit import agents
from livekit.agents import Agent, AgentSession, RoomInputOptions
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero

from ctsm.prompt import BASE_PROMPT
from src.ctsm.mcp.agent_tools import MCPToolsIntegration
from src.ctsm.mcp.context import get_context
from src.ctsm.mcp.util import MCPServerConfig, get_mcps_from_config

logger = logging.getLogger(__name__)

# Store original argv globally so load_config_from_args can access it
_original_argv = None


def load_config_from_args() -> Dict[str, Any]:
    """Load configuration from command line arguments passed by Electron."""
    global _original_argv
    argv_to_search = _original_argv if _original_argv else sys.argv

    # Find the config JSON in arguments (skip 'console' command)
    config_json = None
    for arg in argv_to_search[1:]:
        if arg != "console" and arg.startswith("{"):
            config_json = arg
            break

    if not config_json:
        raise ValueError("Configuration JSON required as argument")

    try:
        return json.loads(config_json)
    except json.JSONDecodeError as e:
        logger.error(f"Invalid configuration JSON: {e}")
        raise


async def entrypoint(ctx: agents.JobContext):
    # Load configuration from Electron
    try:
        electron_config = load_config_from_args()
        logger.info(f"Loaded configuration from Electron: {electron_config.get('userContext', {}).get('name', 'Unknown')}")
        logger.info(f"Loaded configuration from Electron: {electron_config}")
    except Exception as e:
        logger.error(f"Failed to load configuration: {e}")
        # Fallback to environment variables
        electron_config = {
            "secrets": {
                "openaiApiKey": os.environ.get("OPENAI_API_KEY", ""),
                "deepgramApiKey": os.environ.get("DEEPGRAM_API_KEY", ""),
                "cartesiaApiKey": os.environ.get("CARTESIA_API_KEY", ""),
                "aciApiKey": os.environ.get("ACI_API_KEY", ""),
            },
            "systemPrompt": "You are a helpful voice AI assistant.",
            "mcpServers": [],
            "userContext": {"name": "", "preferences": "", "additionalInfo": ""},
        }

    # Get user context
    context = await get_context()

    # Build enhanced context with user info
    user_context_parts = []
    if electron_config.get("userContext", {}).get("name"):
        user_context_parts.append(f"User name: {electron_config['userContext']['name']}")
    if electron_config.get("userContext", {}).get("preferences"):
        user_context_parts.append(f"User preferences: {electron_config['userContext']['preferences']}")
    if electron_config.get("userContext", {}).get("additionalInfo"):
        user_context_parts.append(f"Additional context: {electron_config['userContext']['additionalInfo']}")

    user_context_str = "\n".join(user_context_parts)
    full_context = f"{context}\n\n{user_context_str}" if user_context_str else context

    # Create system prompt with context
    system_prompt = electron_config.get("systemPrompt", "You are a helpful voice AI assistant.")
    prompt_with_context = f"{BASE_PROMPT}\n\n{system_prompt}\n\nUser context: {full_context}"

    # Create MCP server configurations from Electron config
    mcp_server_configs = []
    for server in electron_config.get("mcpServers", []):
        # Handle ACI server specially to inject API key
        if "aci-mcp" in " ".join(server.get("args", [])):
            # Replace the ACI_API_KEY placeholder in the command
            args = []
            for arg in server.get("args", []):
                if "$ACI_API_KEY" in arg:
                    arg = arg.replace("$ACI_API_KEY", electron_config["secrets"]["aciApiKey"])
                args.append(arg)
            server["args"] = args

        mcp_server_configs.append(MCPServerConfig(command=server["command"], args=server["args"], name=server["name"]))

    # Create MCP servers
    mcp_servers = get_mcps_from_config(mcp_server_configs)
    await asyncio.sleep(0.5)

    class Assistant(Agent):
        def __init__(self) -> None:
            super().__init__(instructions=prompt_with_context)

    agent = await MCPToolsIntegration.create_agent_with_tools(
        agent_class=Assistant,
        mcp_servers=mcp_servers,
    )

    # Create session with API keys from Electron
    session = AgentSession(
        turn_detection="vad",
        stt=deepgram.STT(
            model="nova-3",
            language="en",
            api_key=electron_config["secrets"].get("deepgramApiKey", "NOT_SET"),
        ),
        llm=openai.LLM(
            model="gpt-4o",  # Changed from gpt-5 to available model
            api_key=electron_config["secrets"].get("openaiApiKey", "NOT_SET"),
        ),
        tts=cartesia.TTS(
            model="sonic-2",
            language="en",
            api_key=electron_config["secrets"].get("cartesiaApiKey", "NOT_SET"),
        ),
        vad=silero.VAD.load(),
        preemptive_generation=True,
        max_tool_steps=5,
        use_tts_aligned_transcript=True,
    )

    logger.info(f"System prompt: {prompt_with_context}...")
    logger.info(f"Full context: {full_context}...")
    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # Generate greeting with user name if available
    user_name = electron_config.get("userContext", {}).get("name", "")
    greeting_instruction = f"Greet the user{f' by name ({user_name})' if user_name else ''} and ask how you can help."
    await session.generate_reply(instructions=greeting_instruction)


if __name__ == "__main__":
    # Store original argv globally
    _original_argv = sys.argv.copy()

    # Filter out the config JSON from sys.argv before passing to agents CLI
    filtered_argv = [arg for arg in sys.argv if not (arg.startswith("{") and arg.endswith("}"))]
    sys.argv = filtered_argv

    # Set environment variable to disable terminal audio interface
    os.environ["LIVEKIT_CONSOLE_DISABLE_STDIN"] = "1"

    try:
        agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
    finally:
        sys.argv = _original_argv
