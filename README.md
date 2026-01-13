# MCP Application

A multi-component Model Context Protocol (MCP) application demonstrating ChatGPT Apps SDK integration with OAuth authentication.

## Components

- **MCP Server** (`mcp/`) - FastAPI server implementing MCP protocol with Talabat vendor discovery tools
- **Web UI** (`web/`) - React/Vite widget gallery for UI components
- **Backend API** (`backend/`) - Flask-based idea management API

## Quick Start

### MCP Server
```bash
cd mcp
uv sync
uv run python -m src.app
# Server runs on http://localhost:5000
```

### Web UI
```bash
cd web
pnpm install
pnpm dev
# UI runs on http://localhost:5173
```

### Backend API
```bash
cd backend
uv sync
uv run python -m src.app
# API runs on http://localhost:8000
```

## Requirements

- Python 3.11+
- Node.js 18+
- uv (Python package manager)
- pnpm (Node package manager)

## Configuration

Copy `.env.example` to `.env` and configure:
- OAuth settings (Scalekit)
- API endpoints
- Server ports

## Features

- OAuth 2.0 authentication via Scalekit
- Vendor discovery with location-based filtering
- Widget-backed UI components
- FastAPI with MCP protocol support
- CORS-enabled REST APIs
