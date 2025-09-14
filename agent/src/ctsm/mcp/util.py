import asyncio
import functools
import json
import logging
from typing import Any, Dict, List

from pydantic import BaseModel
from mcp.types import CallToolResult

logger = logging.getLogger(__name__)

# Import from mcp libraries
from mcp.types import Tool as MCPTool

from .server import MCPServer


# A minimal FunctionTool class used by the agent.
class FunctionTool:
    def __init__(self, name: str, description: str, params_json_schema: Dict[str, Any], on_invoke_tool, strict_json_schema: bool = False):
        self.name = name
        self.description = description
        self.params_json_schema = params_json_schema
        self.on_invoke_tool = on_invoke_tool  # This should be an async function.
        self.strict_json_schema = strict_json_schema

    def __repr__(self):
        return f"FunctionTool(name={self.name})"

class MCPUtil:
    @classmethod
    async def get_function_tools(cls, server, convert_schemas_to_strict: bool) -> List[FunctionTool]:
        tools = await server.list_tools()
        function_tools = []
        for tool in tools:
            ft = cls.to_function_tool(tool, server, convert_schemas_to_strict)
            function_tools.append(ft)
        return function_tools

    @classmethod
    def to_function_tool(cls, tool, server, convert_schemas_to_strict: bool) -> FunctionTool:
        # Convert the JSON schema to strict format for OpenAI function calling if requested
        schema = tool.inputSchema
        if convert_schemas_to_strict:
            original_schema = schema
            schema = cls._make_schema_strict(schema)
            logger.debug(f"Schema conversion for {tool.name}:")
            logger.debug(f"Original: {json.dumps(original_schema, indent=2)}")
            logger.debug(f"Strict: {json.dumps(schema, indent=2)}")

        # Use a default argument to capture the current tool correctly in the closure
        async def invoke_tool(context: Any, input_json: str, current_tool_name=tool.name) -> str:
            try:
                arguments = json.loads(input_json) if input_json else {}
            except Exception as e:
                # Return error message as string
                return f"Error parsing input JSON for tool '{current_tool_name}': {e}"
            try:
                result = await server.call_tool(current_tool_name, arguments)
                # Ensure the final return value is a string
                if "content" in result and isinstance(result["content"], list) and len(result["content"]) >= 1:
                     # Handle single or multiple content items - convert to string
                     if len(result["content"]) == 1:
                         content_item = result["content"][0]
                         # Convert simple types explicitly to string
                         if isinstance(content_item, (str, int, float, bool)):
                             return str(content_item)
                         # Convert complex types (like dict, list) to JSON string
                         else:
                             try:
                                 return json.dumps(content_item)
                             except TypeError:
                                 return str(content_item) # Fallback to default string representation
                     else:
                         # Multiple content items, return as JSON array string
                          try:
                              return json.dumps(result["content"])
                          except TypeError:
                              return str(result["content"]) # Fallback
                else:
                    # If 'content' is missing, not a list, or empty, return string representation of the whole result
                    try:
                        return json.dumps(result)
                    except TypeError:
                        return str(result) # Fallback
            except Exception as e:
                 # Catch errors during tool call itself
                 return f"Error calling tool '{current_tool_name}': {e}"

        return FunctionTool(
            name=tool.name,
            description=tool.description,
            params_json_schema=schema,
            on_invoke_tool=invoke_tool,
            strict_json_schema=convert_schemas_to_strict,
        )

    @classmethod
    def _make_schema_strict(cls, schema: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert a JSON schema to strict format required by OpenAI function calling.
        This recursively adds 'additionalProperties': false to all object schemas.
        """
        if not isinstance(schema, dict):
            return schema

        # Create a deep copy to avoid modifying the original
        strict_schema = schema.copy()

        # If this is an object type, add additionalProperties: false
        if strict_schema.get("type") == "object":
            strict_schema["additionalProperties"] = False

        # Recursively process properties
        if "properties" in strict_schema:
            strict_properties = {}
            for prop_name, prop_schema in strict_schema["properties"].items():
                strict_properties[prop_name] = cls._make_schema_strict(prop_schema)
            strict_schema["properties"] = strict_properties

        # Recursively process items (for arrays)
        if "items" in strict_schema:
            strict_schema["items"] = cls._make_schema_strict(strict_schema["items"])

        # Recursively process oneOf, anyOf, allOf
        for key in ["oneOf", "anyOf", "allOf"]:
            if key in strict_schema:
                strict_schema[key] = [cls._make_schema_strict(item) for item in strict_schema[key]]

        return strict_schema


class MCPServerConfig(BaseModel):
    command: str
    args: List[str]
    name: str


def get_mcps_from_config(mcp_configs: List[MCPServerConfig]):
    """
    Create MCPServerStdio objects from configuration.

    Args:
        mcp_configs: List of MCPServerConfig objects

    Returns:
        List of MCPServerStdio objects

    Example config:
    [
        MCPServerConfig(
            command="npx",
            args=["-y", "@upstash/context7-mcp@latest"],
            name="Context7 MCP Server"
        ),
        MCPServerConfig(
            command="npx",
            args=["-y", "apple-mcp@latest"],
            name="Apple MCP Server"
        )
    ]
    """
    from .server import MCPServerStdio

    servers = []
    for config in mcp_configs:
        server = MCPServerStdio(
            params={"command": config.command, "args": config.args},
            cache_tools_list=True,
            name=config.name
        )
        servers.append(server)

    return servers
    