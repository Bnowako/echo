import asyncio
import logging
import os
import subprocess

from livekit import agents
from livekit.agents import Agent, AgentSession, RoomInputOptions
from livekit.plugins import cartesia, deepgram, noise_cancellation, openai, silero

from src.ctsm.mcp.agent_tools import MCPToolsIntegration
from src.ctsm.mcp.context import get_context
from src.ctsm.mcp.util import MCPServerConfig, get_mcps_from_config
from src.ctsm.models import Configuration

logger = logging.getLogger(__name__)


def get_calendar_names():
    """Get all calendar names from macOS Calendar app using AppleScript."""
    try:
        result = subprocess.run(
            ["osascript", "-e", 'tell application "Calendar" to return name of every calendar'], capture_output=True, text=True, check=True
        )
        calendar_names = result.stdout.strip().split(", ")
        return calendar_names
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to get calendar names: {e}")
        return ["Calendar"]  # fallback to default


prmpt = """
    You are a helpful voice AI assistant. Speak in english but if user changes the language to another language, 
    speak in that language.
  
  You are a voice assistant. Speak in english in a way human would speak in natural conversation.
   - If you are outputing numbers use write them in english instead of using digits "one" "two" "twenty twoo"
   - If you are outputing dates use the format "September first two tounsand twenty five"
   - If you are outputing times use the format "ten AM"

   You can also use the browser with playwright tools.

   With each tool call in the same time output the text explaining what are you going to do.
"""

configuration = Configuration(
    system_prompt=prmpt,
    servers=[
        MCPServerConfig(
            command="bash",
            args=[
                "-c",
                f"ACI_API_KEY={os.environ.get('ACI_API_KEY')} uvx aci-mcp@latest apps-server --apps HACKERNEWS --linked-account-owner-id user",
            ],
            name="ACI MCP Server",
        ),
        MCPServerConfig(command="npx", args=["@playwright/mcp@latest"], name="Playwright MCP Server"),
    ],
)


async def entrypoint(ctx: agents.JobContext):
    context = await get_context()
    prompt_with_context = configuration.system_prompt + f"\n\nAdditional context: {context}"
    logger.info(f"context: {context}")

    logger.info(f"prompt: {configuration.system_prompt}")

    # Create MCP servers from config
    mcp_servers = get_mcps_from_config(configuration.servers)
    await asyncio.sleep(0.5)

    class Assistant(Agent):
        def __init__(self) -> None:
            super().__init__(instructions=prompt_with_context)

    agent = await MCPToolsIntegration.create_agent_with_tools(
        agent_class=Assistant,
        mcp_servers=mcp_servers,
    )

    session = AgentSession(
        turn_detection="vad",
        stt=deepgram.STT(
            model="nova-3",
            language="en",
            api_key=os.environ.get("DEEPGRAM_API_KEY", "NOT_SET"),
        ),
        llm=openai.LLM(
            model="gpt-5",
        ),
        tts=cartesia.TTS(
            model="sonic-2",
            language="en",
            api_key=os.environ.get("CARTESIA_API_KEY", "NOT_SET"),
        ),
        vad=silero.VAD.load(),
        preemptive_generation=True,
        max_tool_steps=5,
        use_tts_aligned_transcript=True,
    )

    await session.start(
        room=ctx.room,
        agent=agent,
        room_input_options=RoomInputOptions(
            # For telephony applications, use `BVCTelephony` instead for best results
            noise_cancellation=noise_cancellation.BVC(),
        ),
    )

    # await session.generate_reply(instructions="Greet in english the user and offer your assistance.")
    await session.generate_reply(instructions="Greet the user, and ask how can you help. Use users name for the greeting.")


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
