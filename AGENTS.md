# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a multi-component MCP (Model Context Protocol) application demonstrating Apps SDK integration with ChatGPT. It consists of three main parts:

1. **MCP Server** (`mcp/`) - Python FastAPI server implementing MCP protocol with OAuth authentication
2. **Web UI** (`web/`) - React/Vite widget gallery showcasing various UI components
3. **Backend API** (`backend/`) - Flask-based idea management API (separate from MCP)

## Common Commands

### MCP Server (Python)

```bash
# Setup
cd mcp
uv sync  # Install dependencies
source .venv/bin/activate

# Run server
uv run python -m src.app
# or
python -m src.app

# Server runs on http://localhost:5000 by default
```

### Web UI (React/Vite)

```bash
cd web

# Install dependencies
pnpm install

# Build all widget assets (generates assets/*.html)
pnpm run build

# Serve static assets (required for MCP servers)
pnpm run serve  # Runs on http://localhost:4444

# Development
pnpm run dev  # Vite dev server
pnpm run dev:host  # Host-specific dev mode
```

### Backend API (Flask)

```bash
cd backend

# Setup
uv sync
source .venv/bin/activate

# Run server
uv run python app.py  # Runs on http://localhost:5055

# Run tests
uv run python test_api.py
```

## Architecture

### MCP Server Architecture

The MCP server (`mcp/src/`) implements the Model Context Protocol with these key components:

- **app.py** - FastAPI application entry point, wires together:
  - CORS middleware for cross-origin requests
  - `AuthMiddleware` for OAuth token validation via Scalekit
  - MCP server mounted at root `/`
  - OAuth metadata endpoint at `/.well-known/oauth-protected-resource`

- **pizzaz_mcp_server.py** - Core MCP implementation:
  - Defines widget schemas (`PizzazWidget` dataclass)
  - Loads pre-built HTML from `web/assets/` directory
  - Implements MCP protocol handlers: `list_tools`, `list_resources`, `call_tool`, `read_resource`
  - Returns widgets as `text/html+skybridge` MIME type with OpenAI metadata

- **auth.py** - Authentication middleware:
  - Validates Bearer tokens using Scalekit SDK
  - Enforces scope requirements for tool calls (e.g., `search:read`)
  - Bypasses auth for `.well-known` endpoints

- **config.py** - Environment configuration using python-dotenv:
  - Server port, OAuth settings, Tavily API key
  - Auth provider (Scalekit) credentials

### Web UI Architecture

The web UI (`web/src/`) is a collection of standalone React widgets:

- Each widget is a separate entry point (e.g., `pizzaz/`, `kitchen-sink-lite/`, `solar-system/`)
- Built with `@openai/apps-sdk-ui` and custom React components
- Uses `window.openai` API for:
  - Reading host state: `toolInput`, `toolOutput`, `widgetState`, `theme`, `displayMode`
  - Writing state: `setWidgetState`
  - Calling tools: `callTool`
  - Host helpers: `requestDisplayMode`, `openExternal`, `sendFollowUpMessage`

**Build System**:
- `build-all.mts` - Custom Vite orchestrator that bundles each widget into versioned `.html`, `.js`, `.css` files
- Output goes to `web/assets/` directory
- Assets are served via `pnpm run serve` on port 4444
- MCP server references these assets using `ASSETS_DIR` path resolution

### Backend API Architecture

The backend (`backend/`) is a standalone Flask API unrelated to MCP:

- **app.py** - Flask REST API with Swagger/OpenAPI docs
- **models.py** - SQLite persistence layer for ideas (CRUD operations)
- Single-file SQLite database (`ideate.db`)
- Append-only notes with 5-level urgency system

## Key Integration Points

### MCP Server ↔ Web UI

1. MCP server loads HTML from `web/assets/` using `_load_widget_html()`
2. Widget HTML paths are cached with `@lru_cache`
3. Each widget has a `template_uri` (e.g., `ui://widget/pizza-map.html`)
4. MCP `ReadResourceRequest` serves the HTML content
5. `CallToolRequest` returns structured data that hydrates the widget

### OAuth Flow

1. Client sends request with `Authorization: Bearer <token>` header
2. `AuthMiddleware` intercepts all requests except `/.well-known`
3. Token validated against Scalekit with issuer/audience checks
4. Tool calls additionally require scope validation (configured per tool)
5. Failed auth returns 401 with `WWW-Authenticate` header pointing to metadata URL

### Environment Configuration

**Critical**: MCP server requires `.env` file in `mcp/` directory with:
- `TAVILY_API_KEY` - For web search functionality
- `AUTH_PROVIDER_*` - Scalekit OAuth credentials
- `OAUTH_PROTECTED_RESOURCE_METADATA_JSON` - OAuth discovery metadata
- `RESOURCE` - Base URL of the MCP server

## Development Workflow

### Adding a New Widget

1. Create widget component in `web/src/<widget-name>/`
2. Build: `cd web && pnpm run build`
3. Start asset server: `pnpm run serve`
4. Add widget definition to `mcp/src/pizzaz_mcp_server.py`:
   - Add `PizzazWidget` entry to `widgets` list
   - Widget HTML will be auto-loaded from `assets/<component-name>.html`
5. Restart MCP server to pick up changes

### Widget HTML Caching

**Important**: The MCP server uses `@lru_cache` on `_load_widget_html()`. After rebuilding widgets, you must restart the MCP server for changes to take effect.

### Testing MCP Server Locally

1. Build web assets: `cd web && pnpm run build`
2. Serve assets: `pnpm run serve` (port 4444)
3. Run MCP server: `cd mcp && uv run python -m src.app` (port 5000)
4. Use ngrok to expose: `ngrok http 5000`
5. Configure `MCP_ALLOWED_HOSTS` and `MCP_ALLOWED_ORIGINS` for ngrok domain
6. Add connector in ChatGPT Settings → Connectors

## Package Management

- **Python**: Uses `uv` for fast dependency resolution
  - `uv sync` - Install/sync dependencies
  - `uv add <package>` - Add runtime dependency
  - `pyproject.toml` is source of truth

- **JavaScript**: Uses `pnpm` with workspace support
  - `pnpm install` - Install dependencies
  - Single workspace defined in `pnpm-workspace.yaml`

## Important File Paths

- `mcp/src/pizzaz_mcp_server.py:37` - `ASSETS_DIR` path configuration
- `web/build-all.mts` - Build orchestrator for all widgets
- `mcp/src/app.py:50` - MCP server mount point
- `mcp/src/auth.py:66` - Tool scope requirements
- `web/src/*/` - Individual widget entry points

## Common Pitfalls

1. **Widget changes not reflected**: Restart MCP server to clear `@lru_cache`
2. **Assets not found**: Ensure `pnpm run serve` is running and `ASSETS_DIR` path is correct
3. **OAuth errors**: Check `.env` file exists and has correct Scalekit credentials
4. **CORS issues**: MCP server allows all origins by default; restrict in production
5. **DNS rebinding protection**: When using ngrok, must set `MCP_ALLOWED_HOSTS` environment variable
