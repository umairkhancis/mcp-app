"""Ideate MCP Server - Python Implementation

This module provides MCP tools and resources for managing ideas through the Ideate API.
It includes interactive UI components for displaying and editing ideas.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime
from urllib.parse import urlencode

import httpx
from mcp.server.fastmcp import FastMCP
from mcp.types import TextResourceContents, ReadResourceResult
from pydantic import BaseModel, Field


# Type definitions matching the API schema
class Note(BaseModel):
    text: str
    timestamp: str


class Idea(BaseModel):
    id: str
    title: str
    description: str
    urgency: int
    archived: bool
    created_date: str
    updated_date: str
    notes: List[Note] = Field(default_factory=list)


class CreateIdeaRequest(BaseModel):
    title: str
    description: str
    urgency: int = 3


class UpdateIdeaRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    urgency: Optional[int] = None
    archived: Optional[bool] = None
    notes: Optional[List[str]] = None


# Configuration
IDEATE_API_BASE = os.getenv("IDEATE_API_URL", "http://localhost:5055")
ASSETS_PATH = Path(__file__).parent.parent.parent / "web" / "assets"

# Load manifest
manifest_path = ASSETS_PATH / "manifest.json"
with open(manifest_path, "r") as f:
    manifest = json.load(f)


def load_asset_text(file_name: Optional[str]) -> str:
    """Load asset text from file, returning empty string if not found."""
    if not file_name:
        return ""

    abs_path = ASSETS_PATH / file_name
    try:
        return abs_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""  # Tolerate missing css (e.g., if inlined via JS import)


# Load component assets
idea_list_meta = manifest["components"]["ideas-list"]
idea_detail_meta = manifest["components"]["idea-detail"]

IDEA_LIST_JS = load_asset_text(idea_list_meta.get("js"))
IDEA_LIST_CSS = load_asset_text(idea_list_meta.get("css"))
IDEA_DETAIL_JS = load_asset_text(idea_detail_meta.get("js"))
IDEA_DETAIL_CSS = load_asset_text(idea_detail_meta.get("css"))

# Shared widget metadata flags
WIDGET_META_FLAGS = {
    "openai/widgetAccessible": True,
    "openai/resultCanProduceWidget": True,
}

# Versioned URIs from manifest
VERSIONED_URIS = {
    "ideasList": idea_list_meta.get("resourceUri", f"ui://widget/v{manifest['version']}/ideas-list.html"),
    "ideaDetail": idea_detail_meta.get("resourceUri", f"ui://widget/v{manifest['version']}/idea-detail.html"),
}


def widget_html(root_id: str, js: str, css: str = "") -> str:
    """Generate HTML for widget with embedded JS and CSS."""
    css_tag = f"<style>{css}</style>" if css else ""
    return f"""
<div id="{root_id}"></div>
{css_tag}
<script type="module">{js}</script>
""".strip()


# Create MCP server
ideate_mcp = FastMCP("ideate-mcp-server")


# Helper function for API requests
async def make_api_request(endpoint: str, method: str = "GET", data: Optional[Dict] = None) -> Any:
    """Make an API request to the Ideate backend."""
    url = f"{IDEATE_API_BASE}{endpoint}"

    async with httpx.AsyncClient() as client:
        headers = {"Content-Type": "application/json"}

        if method == "GET":
            response = await client.get(url, headers=headers)
        elif method == "POST":
            response = await client.post(url, headers=headers, json=data)
        elif method == "PUT":
            response = await client.put(url, headers=headers, json=data)
        elif method == "DELETE":
            response = await client.delete(url, headers=headers)
        else:
            raise ValueError(f"Unsupported HTTP method: {method}")

        response.raise_for_status()
        return response.json()


# Tools

@ideate_mcp.tool(
    description="Create a new idea in Ideate",
    annotations={
        **WIDGET_META_FLAGS,
        "openai/outputTemplate": VERSIONED_URIS["ideaDetail"],
        "openai/toolInvocation/invoking": "Creating idea...",
        "openai/toolInvocation/invoked": "Idea created",
    }
)
async def create_idea(
    title: str = Field(description="The title of the idea"),
    description: str = Field(description="The description of the idea"),
    urgency: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Urgency level (1=Not Important, 2=Low, 3=Medium, 4=High, 5=Immediate)"
    )
) -> Dict[str, Any]:
    """Create a new idea in Ideate."""
    idea_data = await make_api_request(
        "/ideas",
        method="POST",
        data={"title": title, "description": description, "urgency": urgency}
    )

    return {
        "content": [
            {
                "type": "text",
                "text": f"Created new idea: **{idea_data['title']}**"
            }
        ],
        "structuredContent": {
            "idea": idea_data
        },
        "_meta": {
            "operation": "create",
            "createdAt": datetime.utcnow().isoformat(),
            "ideaId": idea_data["id"]
        }
    }


@ideate_mcp.tool(
    description="Get a specific idea by ID",
    annotations={
        **WIDGET_META_FLAGS,
        "openai/outputTemplate": VERSIONED_URIS["ideaDetail"],
        "openai/toolInvocation/invoking": "Loading idea details...",
        "openai/toolInvocation/invoked": "Idea details loaded",
    }
)
async def get_idea(
    idea_id: str = Field(description="The ID of the idea to retrieve")
) -> Dict[str, Any]:
    """Get a specific idea by ID."""
    idea = await make_api_request(f"/ideas/{idea_id}")

    notes_count = len(idea.get("notes", []))
    archived_status = "Archived" if idea["archived"] else "Active"

    return {
        "content": [
            {
                "type": "text",
                "text": f"**{idea['title']}**\n\n{idea['description']}\n\n"
                       f"Urgency: {idea['urgency']}/5 | {archived_status} | {notes_count} notes"
            }
        ],
        "structuredContent": {
            "idea": idea
        },
        "_meta": {
            "loadedAt": datetime.utcnow().isoformat(),
            "ideaId": idea["id"]
        }
    }


@ideate_mcp.tool(
    description="List all ideas with optional filtering",
    annotations={
        **WIDGET_META_FLAGS,
        "openai/outputTemplate": VERSIONED_URIS["ideasList"],
        "openai/toolInvocation/invoking": "Loading ideas...",
        "openai/toolInvocation/invoked": "Ideas loaded",
    }
)
async def list_ideas(
    includeArchived: bool = Field(default=False, description="Include archived ideas"),
    archivedOnly: bool = Field(default=False, description="Return only archived ideas")
) -> Dict[str, Any]:
    """List all ideas with optional filtering."""
    params = {}
    if includeArchived:
        params["includeArchived"] = "true"
    if archivedOnly:
        params["archivedOnly"] = "true"

    endpoint = "/ideas"
    if params:
        endpoint += f"?{urlencode(params)}"

    ideas = await make_api_request(endpoint)

    structured_data = {
        "ideas": ideas,
        "count": len(ideas)
    }

    filter_desc = "archived " if archivedOnly else ""

    return {
        "content": [
            {
                "type": "text",
                "text": f"Found {len(ideas)} {filter_desc}ideas"
            }
        ],
        "structuredContent": structured_data,
        "_meta": {
            "filters": {
                "includeArchived": includeArchived,
                "archivedOnly": archivedOnly
            },
            "lastSyncedAt": datetime.utcnow().isoformat()
        }
    }


@ideate_mcp.tool(
    description="Update an existing idea",
    annotations={
        **WIDGET_META_FLAGS,
        "openai/outputTemplate": VERSIONED_URIS["ideaDetail"],
        "openai/toolInvocation/invoking": "Updating idea...",
        "openai/toolInvocation/invoked": "Idea updated",
    }
)
async def update_idea(
    idea_id: str = Field(description="The ID of the idea to update"),
    title: Optional[str] = Field(default=None, description="New title for the idea"),
    description: Optional[str] = Field(default=None, description="New description for the idea"),
    urgency: Optional[int] = Field(default=None, ge=1, le=5, description="New urgency level"),
    archived: Optional[bool] = Field(default=None, description="Archive status"),
    notes: Optional[List[str]] = Field(default=None, description="Additional notes to append")
) -> Dict[str, Any]:
    """Update an existing idea."""
    update_data = {}
    changes = []

    if title is not None:
        update_data["title"] = title
        changes.append("title")
    if description is not None:
        update_data["description"] = description
        changes.append("description")
    if urgency is not None:
        update_data["urgency"] = urgency
        changes.append("urgency")
    if archived is not None:
        update_data["archived"] = archived
        changes.append("archived" if archived else "restored")
    if notes is not None:
        update_data["notes"] = notes
        changes.append("notes")

    idea = await make_api_request(f"/ideas/{idea_id}", method="PUT", data=update_data)

    changes_text = f" ({', '.join(changes)})" if changes else ""

    return {
        "content": [
            {
                "type": "text",
                "text": f"Updated **{idea['title']}**{changes_text}"
            }
        ],
        "structuredContent": {
            "idea": idea
        },
        "_meta": {
            "operation": "update",
            "updatedAt": datetime.utcnow().isoformat(),
            "changes": changes,
            "ideaId": idea["id"]
        }
    }


@ideate_mcp.tool(
    description="Append a note to an existing idea (convenience wrapper around update_idea)",
    annotations={
        **WIDGET_META_FLAGS,
        "openai/outputTemplate": VERSIONED_URIS["ideaDetail"],
        "openai/toolInvocation/invoking": "Adding note...",
        "openai/toolInvocation/invoked": "Note added",
    }
)
async def add_note(
    idea_id: str = Field(description="The ID of the idea to append a note to"),
    note: str = Field(description="The note text to append", min_length=1)
) -> Dict[str, Any]:
    """Append a note to an existing idea."""
    # Reuse update semantics: backend treats notes array as notes to append
    idea = await make_api_request(
        f"/ideas/{idea_id}",
        method="PUT",
        data={"notes": [note]}
    )

    return {
        "content": [
            {
                "type": "text",
                "text": f"Added note to **{idea['title']}**"
            }
        ],
        "structuredContent": {
            "idea": idea
        },
        "_meta": {
            "operation": "add_note",
            "addedAt": datetime.utcnow().isoformat(),
            "ideaId": idea["id"]
        }
    }


@ideate_mcp.tool(description="Archive an idea")
async def archive_idea(
    idea_id: str = Field(description="The ID of the idea to archive")
) -> Dict[str, Any]:
    """Archive an idea."""
    await make_api_request(f"/ideas/{idea_id}/archive", method="POST")

    return {
        "content": [
            {
                "type": "text",
                "text": f"Idea {idea_id} has been archived"
            }
        ],
        "structuredContent": {
            "success": True,
            "message": f"Idea {idea_id} has been archived"
        },
        "_meta": {
            "operation": "archive",
            "archivedAt": datetime.utcnow().isoformat(),
            "ideaId": idea_id
        }
    }


@ideate_mcp.tool(description="Restore (unarchive) an idea")
async def restore_idea(
    idea_id: str = Field(description="The ID of the idea to restore")
) -> Dict[str, Any]:
    """Restore (unarchive) an idea."""
    await make_api_request(f"/ideas/{idea_id}/restore", method="POST")

    return {
        "content": [
            {
                "type": "text",
                "text": f"Idea {idea_id} has been restored"
            }
        ],
        "structuredContent": {
            "success": True,
            "message": f"Idea {idea_id} has been restored"
        },
        "_meta": {
            "operation": "restore",
            "restoredAt": datetime.utcnow().isoformat(),
            "ideaId": idea_id
        }
    }


@ideate_mcp.tool(description="Delete an idea permanently")
async def delete_idea(
    idea_id: str = Field(description="The ID of the idea to delete")
) -> Dict[str, Any]:
    """Delete an idea permanently."""
    await make_api_request(f"/ideas/{idea_id}", method="DELETE")

    return {
        "content": [
            {
                "type": "text",
                "text": f"Idea {idea_id} has been deleted"
            }
        ],
        "structuredContent": {
            "success": True,
            "message": f"Idea {idea_id} has been deleted"
        },
        "_meta": {
            "operation": "delete",
            "deletedAt": datetime.utcnow().isoformat(),
            "ideaId": idea_id
        }
    }


# Resources

@ideate_mcp.resource(
    "ideate://ideas",
    name="ideas",
    title="All Ideas",
    description="All active ideas in Ideate",
    mime_type="application/json"
)
async def get_all_ideas() -> str:
    """Get all active ideas in Ideate."""
    ideas = await make_api_request("/ideas")
    return json.dumps(ideas, indent=2)


@ideate_mcp.resource(
    "ideate://ideas/archived",
    name="archived-ideas",
    title="Archived Ideas",
    description="All archived ideas in Ideate",
    mime_type="application/json"
)
async def get_archived_ideas() -> str:
    """Get all archived ideas in Ideate."""
    ideas = await make_api_request("/ideas?archivedOnly=true")
    return json.dumps(ideas, indent=2)


@ideate_mcp.resource(
    "ideate://ideas/{idea_id}",
    name="idea",
    title="Individual Idea",
    description="A specific idea by ID",
    mime_type="application/json"
)
async def get_idea_resource(idea_id: str) -> str:
    """Get a specific idea by ID."""
    idea = await make_api_request(f"/ideas/{idea_id}")
    return json.dumps(idea, indent=2)


@ideate_mcp.resource(
    "ideate://status",
    name="api-status",
    title="API Status",
    description="Ideate API status and information",
    mime_type="application/json"
)
async def get_api_status() -> str:
    """Get Ideate API status and information."""
    try:
        status = await make_api_request("/")
        return json.dumps(status, indent=2)
    except Exception as e:
        error_info = {
            "error": "Failed to connect to Ideate API",
            "details": str(e),
            "api_url": IDEATE_API_BASE
        }
        return json.dumps(error_info, indent=2)


# UI Resources - Note: FastMCP doesn't support _meta in resource contents
# The widget metadata is passed via the resource-level annotations in tools

@ideate_mcp.resource(
    VERSIONED_URIS["ideasList"],
    name="ideas-list-ui",
    title="Ideas List UI",
    description="Interactive UI for displaying and managing ideas list",
    mime_type="text/html+skybridge"
)
async def get_ideas_list_ui() -> str:
    """Interactive UI for displaying and managing ideas list.

    Widget Description: Renders an interactive UI showing the ideas returned by
    list_ideas for browsing, filtering, and navigating to idea details.
    """
    return widget_html("ideas-list-root", IDEA_LIST_JS, IDEA_LIST_CSS)


@ideate_mcp.resource(
    VERSIONED_URIS["ideaDetail"],
    name="idea-detail-ui",
    title="Idea Detail UI",
    description="Interactive UI for viewing and editing a specific idea",
    mime_type="text/html+skybridge"
)
async def get_idea_detail_ui() -> str:
    """Interactive UI for viewing and editing a specific idea.

    Widget Description: Renders an interactive UI with the details of the idea
    returned by create_idea, get_idea, update_idea, and add_note.
    """
    return widget_html("idea-detail-root", IDEA_DETAIL_JS, IDEA_DETAIL_CSS)
