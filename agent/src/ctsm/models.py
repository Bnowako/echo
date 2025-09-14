from typing import List

from pydantic import BaseModel

from src.ctsm.mcp.util import MCPServerConfig


class Configuration(BaseModel):
    system_prompt: str
    servers: List[MCPServerConfig]
