# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an MCP (Model Context Protocol) server that provides web search capabilities through the Tavily API. The server is built using FastAPI and FastMCP, exposing tools that can be consumed by MCP clients like Claude Desktop or other AI assistants.

## Development Commands

### Running the Server

```bash
# Using uv (recommended)
uv run mcp-server

# Or using Python directly
python -m src.app
```

The server runs on `http://localhost:5000` by default (configurable via `PORT` environment variable).

### Installing Dependencies

```bash
# Install dependencies with uv
uv sync

# Or install in development mode
uv pip install -e .
```

### Environment Setup

Copy `.env` file and configure:
- `TAVILY_API_KEY`: Required for web search functionality
- `PORT`: Server port (defaults to 5000)

## Architecture

### Core Components

**src/app.py**
- Main FastAPI application entry point
- Configures CORS middleware for cross-origin requests
- Mounts the MCP server at the root path
- Contains `main()` function for uvicorn server startup

**src/mcp_server.py**
- Defines the FastMCP server instance
- Registers MCP tools using `@mcp.tool()` decorator
- Currently provides `web_search` tool powered by Tavily
- This is where new MCP tools should be added

**src/config.py**
- Centralized configuration using environment variables
- Loads settings from `.env` file via python-dotenv
- Validates required environment variables

### Adding New MCP Tools

Tools are registered in `src/mcp_server.py` using the `@mcp.tool()` decorator:

```python
@mcp.tool()
def tool_name(param: str) -> ReturnType:
    """
    Tool description that will be visible to MCP clients.

    Args:
        param: Description of parameter

    Returns:
        Description of return value
    """
    # Implementation
```

Key points:
- Tool functions must have type hints for parameters and return values
- Docstrings are used by MCP clients to understand tool capabilities
- Tools should handle exceptions gracefully and return error information

### MCP Server Initialization

The MCP server is created using `FastMCP("web-search")` where "web-search" is the server name visible to clients. The server is converted to a FastAPI-compatible app using `.streamable_http_app()` and mounted to the main FastAPI application.

## Important Notes

- The variable naming bug on line 28 of `src/app.py`: `tavily_mcp_server.streamable_http_app()` should reference `mcp_server` (imported from `mcp_server` module)
- CORS is configured to allow all origins (`"*"`) - this should be restricted in production
- Authentication middleware is commented out but prepared for future implementation
- The server uses FastMCP which provides HTTP/SSE streaming capabilities for MCP protocol
