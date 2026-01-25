# MCP Server + Widget Development Guide

This document outlines the systematic approach to building new MCP servers with corresponding UI widgets for ChatGPT integration.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ARCHITECTURE FLOW                                  │
│                                                                                 │
│   Backend API ──► MCP Server ──► ChatGPT ──► Widget (React)                     │
│                        │                         ▲                              │
│                        │    structuredContent    │                              │
│                        └─────────────────────────┘                              │
│                           window.openai.toolOutput                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

The **contract** between MCP and Widget is:
- MCP returns `structuredContent` in `CallToolResult`
- Widget reads `window.openai.toolOutput`
- Both must agree on the data shape (TypeScript ↔ Pydantic)

---

## Phase 1: Design (Before Writing Code)

### Step 1.1: Define the Use Case

Answer these questions:
- What will the user ask ChatGPT? (e.g., "Show me nearby restaurants")
- What action does the tool perform? (e.g., fetch vendors from API)
- What does the user see? (e.g., list of vendor cards)

### Step 1.2: Sketch the UI

```
┌─────────────────────────────────┐
│  [Header: Icon + Title]         │
│  [Subtitle: Summary stats]      │
├─────────────────────────────────┤
│  [Card 1: Image + Info]         │
│  [Card 2: Image + Info]         │
│  [Card 3: Image + Info]         │
├─────────────────────────────────┤
│  [Action: Button/CTA]           │
└─────────────────────────────────┘
```

### Step 1.3: Define the Data Model (The Contract)

**TypeScript (Widget side):**
```typescript
// web/src/<widget-name>/types.ts

export interface MyToolOutput {
  items: ItemData[];
  total_count: number;
  metadata: {
    source: string;
    timestamp: string;
  };
}

export interface ItemData {
  id: string;
  name: string;
  description: string;
  image_url: string;
  rating: number;
  // ... map each field to a UI element
}
```

**Pydantic (MCP side):**
```python
# mcp/src/<name>_mcp_server.py

class ItemData(BaseModel):
    id: str
    name: str
    description: str
    image_url: str
    rating: float

class MyToolOutput(BaseModel):
    items: List[ItemData]
    total_count: int
    metadata: dict
```

### Step 1.4: Define the Input Schema

What parameters does ChatGPT send to the tool?

```python
class MyToolInput(BaseModel):
    query: str = Field(..., description="Search query")
    lat: float = Field(..., description="Latitude")
    lng: float = Field(..., description="Longitude")
    limit: int = Field(10, description="Max results")
```

### Step 1.5: Identify Data Source

- [ ] Public API (provide URL and sample response)
- [ ] Mock data (for demo/testing)
- [ ] Internal API (document auth requirements)

---

## Phase 2: Implementation

### Step 2.1: Create the Widget

**Location:** `web/src/<widget-name>/`

**Files to create:**
```
web/src/<widget-name>/
├── index.tsx        # Entry point (REQUIRED)
├── components.tsx   # Reusable components (optional)
├── types.ts         # TypeScript interfaces (optional)
└── styles.css       # Custom styles (optional)
```

**Template: `index.tsx`**
```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { useOpenAiGlobal } from "../use-openai-global";
import { useWidgetState } from "../use-widget-state";

// 1. Define types matching MCP structuredContent
interface MyToolOutput {
  items: ItemData[];
  total_count: number;
}

interface ItemData {
  id: string;
  name: string;
  // ... other fields
}

interface WidgetState {
  selectedId?: string;
  // ... UI state
}

function App() {
  // 2. Read data from MCP (the contract!)
  const toolOutput = useOpenAiGlobal("toolOutput") as MyToolOutput | null;
  const theme = useOpenAiGlobal("theme");
  const isDark = theme === "dark";

  // 3. Manage local widget state
  const [widgetState, setWidgetState] = useWidgetState<WidgetState>({});

  // 4. Handle empty/loading states
  const items = toolOutput?.items || [];
  
  if (items.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        No items found.
      </div>
    );
  }

  // 5. Render UI with data
  return (
    <div className={`p-4 ${isDark ? "bg-gray-900 text-white" : "bg-white text-black"}`}>
      <header className="mb-4">
        <h1 className="text-xl font-bold">My Widget</h1>
        <p className="text-sm opacity-70">{toolOutput?.total_count} items</p>
      </header>
      
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-lg border"
            onClick={() => setWidgetState({ selectedId: item.id })}
          >
            <h3 className="font-medium">{item.name}</h3>
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. Mount React app
const rootElement = document.getElementById("<widget-name>-root");
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
```

**Update `build-all.mts`:**
```typescript
const targets: string[] = [
  // ... existing targets
  "<widget-name>",  // ADD THIS
];
```

### Step 2.2: Create the MCP Server

**Location:** `mcp/src/<name>_mcp_server.py`

**Template:**
```python
"""<Name> MCP server for <description>.

Exposes tools for <what it does> with widget-backed UI components."""

from __future__ import annotations

import os
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List
from datetime import datetime

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, ValidationError
import httpx


# =============================================================================
# STEP 1: Define Data Models (The Contract)
# =============================================================================

class ItemData(BaseModel):
    """Data model for individual items."""
    id: str
    name: str
    description: str
    image_url: str
    rating: float


class MyToolOutput(BaseModel):
    """Output model matching widget's TypeScript interface."""
    items: List[ItemData]
    total_count: int
    metadata: Dict[str, Any]


# =============================================================================
# STEP 2: Widget Configuration
# =============================================================================

@dataclass(frozen=True)
class MyWidget:
    """Widget definition for UI components."""
    identifier: str
    title: str
    template_uri: str
    invoking: str
    invoked: str
    html: str
    response_text: str


ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"
MIME_TYPE = "text/html+skybridge"


@lru_cache(maxsize=None)
def _load_widget_html(component_name: str) -> str:
    """Load widget HTML from assets directory."""
    html_path = ASSETS_DIR / f"{component_name}.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf8")

    fallback_candidates = sorted(ASSETS_DIR.glob(f"{component_name}-*.html"))
    if fallback_candidates:
        return fallback_candidates[-1].read_text(encoding="utf8")

    raise FileNotFoundError(
        f'Widget HTML for "{component_name}" not found in {ASSETS_DIR}. '
        "Run `pnpm run build` in web/ to generate assets."
    )


widgets: List[MyWidget] = [
    MyWidget(
        identifier="<tool-name>",
        title="<Tool Title>",
        template_uri="ui://widget/<widget-name>.html",
        invoking="Loading...",
        invoked="Loaded successfully",
        html=_load_widget_html("<widget-name>"),
        response_text="Successfully loaded data",
    ),
]

WIDGETS_BY_ID: Dict[str, MyWidget] = {w.identifier: w for w in widgets}
WIDGETS_BY_URI: Dict[str, MyWidget] = {w.template_uri: w for w in widgets}


# =============================================================================
# STEP 3: Input Schema
# =============================================================================

class MyToolInput(BaseModel):
    """Input schema for the tool."""
    query: str = Field(..., description="Search query")
    limit: int = Field(10, description="Maximum results to return")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


TOOL_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "query": {
            "type": "string",
            "description": "Search query",
        },
        "limit": {
            "type": "number",
            "description": "Maximum results to return",
        },
    },
    "required": ["query"],
    "additionalProperties": False,
}


# =============================================================================
# STEP 4: FastMCP Server Setup
# =============================================================================

def _split_env_list(value: str | None) -> List[str]:
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _transport_security_settings() -> TransportSecuritySettings:
    allowed_hosts = _split_env_list(os.getenv("MCP_ALLOWED_HOSTS"))
    allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    if not allowed_hosts and not allowed_origins:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=allowed_hosts,
        allowed_origins=allowed_origins,
    )


my_mcp = FastMCP(
    name="<server-name>",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)


# =============================================================================
# STEP 5: Metadata Helpers
# =============================================================================

def _tool_meta(widget: MyWidget) -> Dict[str, Any]:
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
    }


def _tool_invocation_meta(widget: MyWidget) -> Dict[str, Any]:
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }


# =============================================================================
# STEP 6: API Client (Optional)
# =============================================================================

async def _fetch_from_api(query: str, limit: int) -> List[ItemData]:
    """Fetch data from external API."""
    # Option A: Real API call
    # async with httpx.AsyncClient() as client:
    #     response = await client.get(f"https://api.example.com/search?q={query}&limit={limit}")
    #     response.raise_for_status()
    #     data = response.json()
    #     return [ItemData(**item) for item in data["results"]]
    
    # Option B: Mock data (for demo)
    return [
        ItemData(
            id=f"item-{i}",
            name=f"Item {i}: {query}",
            description=f"Description for item {i}",
            image_url=f"https://picsum.photos/seed/{i}/200",
            rating=4.0 + (i % 10) / 10,
        )
        for i in range(min(limit, 5))
    ]


# =============================================================================
# STEP 7: MCP Protocol Handlers
# =============================================================================

@my_mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    """List available tools."""
    return [
        types.Tool(
            name=widget.identifier,
            title=widget.title,
            description=widget.title,
            inputSchema=deepcopy(TOOL_INPUT_SCHEMA),
            _meta=_tool_meta(widget),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        )
        for widget in widgets
    ]


@my_mcp._mcp_server.list_resources()
async def _list_resources() -> List[types.Resource]:
    """List available resources (widget HTML)."""
    return [
        types.Resource(
            name=widget.title,
            title=widget.title,
            uri=widget.template_uri,
            description=f"{widget.title} widget markup",
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


@my_mcp._mcp_server.list_resource_templates()
async def _list_resource_templates() -> List[types.ResourceTemplate]:
    """List resource templates."""
    return [
        types.ResourceTemplate(
            name=widget.title,
            title=widget.title,
            uriTemplate=widget.template_uri,
            description=f"{widget.title} widget markup",
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


async def _handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    """Handle resource read requests - returns widget HTML."""
    widget = WIDGETS_BY_URI.get(str(req.params.uri))
    if widget is None:
        return types.ServerResult(
            types.ReadResourceResult(
                contents=[],
                _meta={"error": f"Unknown resource: {req.params.uri}"},
            )
        )

    contents = [
        types.TextResourceContents(
            uri=widget.template_uri,
            mimeType=MIME_TYPE,
            text=widget.html,
            _meta=_tool_meta(widget),
        )
    ]

    return types.ServerResult(types.ReadResourceResult(contents=contents))


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    """Handle tool calls - fetches data and returns structuredContent."""
    widget = WIDGETS_BY_ID.get(req.params.name)
    if widget is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Unknown tool: {req.params.name}")],
                isError=True,
            )
        )

    # Validate input
    arguments = req.params.arguments or {}
    try:
        payload = MyToolInput.model_validate(arguments)
    except ValidationError as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Validation error: {exc.errors()}")],
                isError=True,
            )
        )

    try:
        # Fetch data from API
        items = await _fetch_from_api(payload.query, payload.limit)

        # Build structured content (THE CONTRACT!)
        structured_data = {
            "items": [item.model_dump() for item in items],
            "total_count": len(items),
            "metadata": {
                "query": payload.query,
                "timestamp": datetime.now().isoformat(),
            },
        }

        meta = _tool_invocation_meta(widget)

        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Found {len(items)} items for '{payload.query}'",
                    )
                ],
                structuredContent=structured_data,
                _meta=meta,
            )
        )

    except httpx.HTTPError as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"API error: {str(exc)}")],
                isError=True,
            )
        )
    except Exception as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Error: {str(exc)}")],
                isError=True,
            )
        )


# Register handlers
my_mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
my_mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource
```

### Step 2.3: Register in app.py

**Update `mcp/src/app.py`:**
```python
from .<name>_mcp_server import my_mcp

# Add to the router/mount
app.mount("/my-endpoint", my_mcp.streamable_http_app())
```

---

## Phase 3: Build & Test

### Step 3.1: Build Widget Assets

```bash
cd web
pnpm run build
```

Verify output:
```bash
ls -la ../mcp/assets/<widget-name>*
# Should see:
# <widget-name>.html
# <widget-name>-<hash>.html
# <widget-name>-<hash>.js
# <widget-name>-<hash>.css
```

### Step 3.2: Start Servers

**Terminal 1: Asset Server**
```bash
cd web
pnpm run serve
# Runs on http://localhost:4444
```

**Terminal 2: MCP Server**
```bash
cd mcp
source .venv/bin/activate
uv run python -m src.app
# Runs on http://localhost:5000
```

### Step 3.3: Test Locally (Optional)

Create `test.html` in `web/src/<widget-name>/`:
```html
<!DOCTYPE html>
<html>
<head>
  <script>
    // Mock window.openai for local testing
    window.openai = {
      toolOutput: {
        items: [
          { id: "1", name: "Test Item 1", description: "...", image_url: "...", rating: 4.5 },
          { id: "2", name: "Test Item 2", description: "...", image_url: "...", rating: 4.2 },
        ],
        total_count: 2,
      },
      theme: "light",
      displayMode: "embedded",
    };
  </script>
</head>
<body>
  <div id="<widget-name>-root"></div>
  <script type="module" src="http://localhost:4444/<widget-name>-<hash>.js"></script>
  <link rel="stylesheet" href="http://localhost:4444/<widget-name>-<hash>.css">
</body>
</html>
```

---

## Phase 4: Deploy & Connect to ChatGPT

### Step 4.1: Expose via ngrok

```bash
ngrok http 5000
```

### Step 4.2: Set Environment Variables

```bash
export MCP_ALLOWED_HOSTS="your-subdomain.ngrok.io"
export MCP_ALLOWED_ORIGINS="https://chatgpt.com"
```

### Step 4.3: Add Connector in ChatGPT

1. Go to ChatGPT Settings → Connectors
2. Add new connector with ngrok URL
3. Test by asking ChatGPT to use your tool

---

## Checklist

### Before Starting
- [ ] Use case defined
- [ ] UI sketched
- [ ] Data model (TypeScript + Pydantic) defined
- [ ] Input schema defined
- [ ] Data source identified

### Widget (`web/`)
- [ ] `web/src/<widget-name>/index.tsx` created
- [ ] Types match MCP `structuredContent`
- [ ] Uses `useOpenAiGlobal("toolOutput")`
- [ ] Handles empty/loading states
- [ ] Supports dark/light theme
- [ ] Added to `build-all.mts` targets

### MCP Server (`mcp/`)
- [ ] `mcp/src/<name>_mcp_server.py` created
- [ ] Pydantic models match TypeScript interfaces
- [ ] `_load_widget_html()` references correct asset name
- [ ] `_call_tool_request()` returns `structuredContent`
- [ ] `_handle_read_resource()` returns HTML
- [ ] Registered in `app.py`

### Build & Test
- [ ] `pnpm run build` succeeds
- [ ] Assets appear in `mcp/assets/`
- [ ] MCP server starts without errors
- [ ] Local test HTML renders correctly

---

## Common Patterns

### Reading Tool Output in Widget
```tsx
const toolOutput = useOpenAiGlobal("toolOutput") as MyOutput | null;
const items = toolOutput?.items || [];
```

### Persisting Widget State
```tsx
const [state, setState] = useWidgetState<MyState>({ selected: null });

// State persists across conversation turns
setState({ selected: itemId });
```

### Sending Follow-up Messages
```tsx
const handleClick = (item: Item) => {
  window.openai?.sendFollowUpMessage({
    prompt: `Tell me more about ${item.name}`,
  });
};
```

### Requesting Fullscreen
```tsx
const handleExpand = () => {
  window.openai?.requestDisplayMode({ mode: "fullscreen" });
};
```

### Opening External Links
```tsx
const handleExternalLink = (url: string) => {
  window.openai?.openExternal({ url });
};
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Widget not updating | Restart MCP server to clear `@lru_cache` |
| Assets not found | Run `pnpm run build` and check `mcp/assets/` |
| CORS errors | Check `MCP_ALLOWED_ORIGINS` env var |
| Tool not appearing | Verify `list_tools()` returns your tool |
| Data not showing | Check `structuredContent` shape matches TypeScript interface |
| Theme not working | Use `useOpenAiGlobal("theme")` and apply conditional classes |


## Execution

Required Prompt Inputs from user:
- BUSINESS_NAME: Name of the business.
- BUSINESS_DESCRIPTION: Describe the business model.
- PROMPT_TO_CHATGPT: A sample prompt to chat gpt.

Please execute this prompt for the business name $BUSINESS_NAME.
$BUSINESS_DESCRIPTION.

What will the user ask ChatGPT? 
$PROMPT_TO_CHATGPT

What action does the tool perform?
Fetch data from API.

What does the user see? 
Show UI.

Design a typical data model for $BUSINESS_DESCRIPTION.
Simulate an API call with a mocked response data model.

Checkout /web/src/ folder for UI widgets examples like pizzaz albums, carousel, list, shop.

Design various tool calls and UI resources (like pizzaz) for the $BUSINESS_NAME ($BUSINESS_DESCRIPTION).
