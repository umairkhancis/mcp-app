"""Talabat MCP server implementing vendor discovery functionality.

This server exposes tools for discovering and browsing Talabat vendors/restaurants
with location-based filtering and pagination. It mirrors the TypeScript implementation
from discovery.ts and provides widget-backed UI components for rendering vendor lists."""

from __future__ import annotations

import os
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, ValidationError
import httpx


# Step 01: Define exposed domain model
class Cuisine(BaseModel):
    """Cuisine information for a vendor."""
    id: int
    na: str
    sl: str


class SponsData(BaseModel):
    """Sponsored vendor data."""
    cat: str
    type: str
    token: str


class VendorRank(BaseModel):
    """Vendor ranking data."""
    rtrk: int
    orrk: int
    acrk: int
    frrk: int
    rork: int
    inrk: int


class Vendor(BaseModel):
    """Complete vendor/restaurant data model."""
    model_config = ConfigDict(extra="allow")
    
    gid: int
    lg: str
    isSnap: bool
    na: str
    bna: str
    bsl: str
    rat: float
    rtxt: str
    sri: bool
    rii: int
    avd: str
    time_estimation: str
    ac: bool
    adb: bool
    acr: bool
    acod: bool
    cav: bool
    mav: bool
    ism: bool
    isn: bool
    isd: bool
    dls: str
    dct: int
    tch: float
    mcc: float
    mtyp: int
    trc: float
    ttyp: int
    sl: str
    an: str
    aid: Optional[str] = None
    cus: List[Cuisine]
    css: str
    adc: str
    att: str
    amt: str
    atbt: str
    hsp: bool
    pdto: int
    pri: str
    act: str
    pmsg: str
    ttrev: str
    trt: str
    trts: str
    des: str
    finalRank: float
    dcl: str
    smr: str
    htd: bool
    htc: bool
    fm: bool
    inc: bool
    ipt: bool
    ipos: bool
    gtl: str
    ius: bool
    icr: bool
    iush: bool
    ust: str
    usicon: str
    uscom: str
    uscomid: int
    sha: int
    shc: int
    rgrl: bool
    ida: bool
    dtxt: str
    otxt: str
    mofs: int
    mdis: int
    ipa: bool
    ptxt: str
    mpro: int
    iccm: bool
    isVatInc: bool
    hrd: bool
    hasv: bool
    fids: List[int]
    ftgs: List[Any]
    verticals: List[int]
    mentyp: int
    isub: bool
    priceTag: int
    ctav: int
    spd: SponsData
    cld: bool
    ismgrtd: bool
    isfof: bool
    rnk: VendorRank
    dhcvid: str
    isTalabatPro: bool
    is_tpro: bool
    is_pickup: bool
    is_tstar: bool
    tstar_desc: Optional[str] = None
    delivery_icon_type: str
    delivery_text: Optional[str] = None
    delay_text: Optional[str] = None
    sponsored_rank: int
    pickupTime: str
    pickupDistance: str
    isVegOnly: bool
    explanation: str
    recommended_friends: List[Any]
    hasDealOffer: bool
    cuisineSlug: str
    isEnrolledInStampCard: bool
    stampsCollected: int
    requiredStamps: int
    stampVoucherDiscount: int
    stampsProgress: int
    is_fast_delivery: Optional[bool] = None
    st: str
    iss: bool
    dtim: int
    mna: int
    dch: float
    id: int
    bid: int
    itg: bool
    stt: int
    Lon: str
    Lat: str
    verticalType: int
    isds: bool
    tpvc: bool
    prom: int
    sldk: float


class VendorsResult(BaseModel):
    """Result data from vendors API."""
    total_vendors: int
    active_event: Any
    price_tag: Any
    showCollections: bool
    restaurants: List[Vendor]
    trending_vendors: List[Vendor]
    top_rated_vendors: List[Vendor]
    midas_request_id: str
    area_id: int
    max_cpc_slots: int


class VendorsResponse(BaseModel):
    """Complete API response for vendors."""
    version: Optional[str] = None
    timestamp: str
    hasserror: bool
    error: Optional[Any] = None
    base_url: Optional[str] = None
    result: Optional[VendorsResult] = None


class SimplifiedCuisine(BaseModel):
    """Simplified cuisine for output."""
    id: int
    name: str
    slug: str


class SimplifiedVendor(BaseModel):
    """Simplified vendor data for output."""
    id: int
    name: str
    business_name: str
    rating: float
    rating_text: str
    delivery_time: str
    time_estimation: str
    cuisines: List[SimplifiedCuisine]
    is_talabat_pro: bool
    logo: str
    cover_image: str
    latitude: str
    longitude: str


@dataclass(frozen=True)
class TalabatWidget:
    """Widget definition for Talabat UI components."""
    identifier: str
    title: str
    template_uri: str
    invoking: str
    invoked: str
    html: str
    response_text: str


# Assets directory configuration
ASSETS_DIR = Path(__file__).resolve().parent.parent / "assets"


@lru_cache(maxsize=None)
def _load_widget_html(component_name: str) -> str:
    """Load widget HTML from assets directory with fallback to versioned files."""
    html_path = ASSETS_DIR / f"{component_name}.html"
    if html_path.exists():
        return html_path.read_text(encoding="utf8")

    fallback_candidates = sorted(ASSETS_DIR.glob(f"{component_name}-*.html"))
    if fallback_candidates:
        return fallback_candidates[-1].read_text(encoding="utf8")

    raise FileNotFoundError(
        f'Widget HTML for "{component_name}" not found in {ASSETS_DIR}. '
        "Run `pnpm run build` in the web directory to generate the assets."
    )


# Widget definitions
widgets: List[TalabatWidget] = [
    TalabatWidget(
        identifier="vendors-list",
        title="List Vendors",
        template_uri="ui://widget/vendors-list.html",
        invoking="Loading vendors...",
        invoked="Vendors loaded",
        html=_load_widget_html("vendors-list"),
        response_text="Successfully loaded vendors",
    ),
]


MIME_TYPE = "text/html+skybridge"

WIDGETS_BY_ID: Dict[str, TalabatWidget] = {
    widget.identifier: widget for widget in widgets
}
WIDGETS_BY_URI: Dict[str, TalabatWidget] = {
    widget.template_uri: widget for widget in widgets
}


class ListVendorsInput(BaseModel):
    """Input schema for list_vendors tool."""
    lat: float = Field(..., description="Latitude coordinate for vendor search")
    long: float = Field(..., description="Longitude coordinate for vendor search")
    page: int = Field(1, description="Page number for pagination (default: 1)")
    size: int = Field(5, description="Number of results per page (default: 5)")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


def _split_env_list(value: str | None) -> List[str]:
    """Split comma-separated environment variable into list."""
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]


def _transport_security_settings() -> TransportSecuritySettings:
    """Configure transport security based on environment variables."""
    allowed_hosts = _split_env_list(os.getenv("MCP_ALLOWED_HOSTS"))
    allowed_origins = _split_env_list(os.getenv("MCP_ALLOWED_ORIGINS"))
    if not allowed_hosts and not allowed_origins:
        return TransportSecuritySettings(enable_dns_rebinding_protection=False)
    return TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=allowed_hosts,
        allowed_origins=allowed_origins,
    )


# Step 02: Initialize FastMCP server
talabat_mcp = FastMCP(
    name="talabat-discovery",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)


# Tool input schema for MCP protocol
TOOL_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "lat": {
            "type": "number",
            "description": "Latitude coordinate for vendor search",
        },
        "long": {
            "type": "number",
            "description": "Longitude coordinate for vendor search",
        },
        "page": {
            "type": "number",
            "description": "Page number for pagination (default: 1)",
        },
        "size": {
            "type": "number",
            "description": "Number of results per page (default: 5)",
        },
    },
    "required": ["lat", "long"],
    "additionalProperties": False,
}


def _resource_description(widget: TalabatWidget) -> str:
    """Generate resource description for widget."""
    return f"{widget.title} widget markup"


def _tool_meta(widget: TalabatWidget) -> Dict[str, Any]:
    """Generate tool metadata for OpenAI integration."""
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
    }


def _tool_invocation_meta(widget: TalabatWidget) -> Dict[str, Any]:
    """Generate invocation metadata for tool calls."""
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }


async def _make_api_request(endpoint: str) -> VendorsResponse:
    """Make HTTP request to Talabat vendors API."""
    async with httpx.AsyncClient() as client:
        response = await client.get(endpoint)
        response.raise_for_status()
        data = response.json()
        return VendorsResponse.model_validate(data)


@talabat_mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    """List all available tools."""
    return [
        types.Tool(
            name="list_vendors",
            title="List Vendors",
            description="List all available vendors/restaurants with filtering by location and pagination",
            inputSchema=deepcopy(TOOL_INPUT_SCHEMA),
            _meta=_tool_meta(WIDGETS_BY_ID["vendors-list"]),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        )
    ]


@talabat_mcp._mcp_server.list_resources()
async def _list_resources() -> List[types.Resource]:
    """List all available resources."""
    return [
        types.Resource(
            name=widget.title,
            title=widget.title,
            uri=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


@talabat_mcp._mcp_server.list_resource_templates()
async def _list_resource_templates() -> List[types.ResourceTemplate]:
    """List all available resource templates."""
    return [
        types.ResourceTemplate(
            name=widget.title,
            title=widget.title,
            uriTemplate=widget.template_uri,
            description=_resource_description(widget),
            mimeType=MIME_TYPE,
            _meta=_tool_meta(widget),
        )
        for widget in widgets
    ]


async def _handle_read_resource(req: types.ReadResourceRequest) -> types.ServerResult:
    """Handle resource read requests for widget HTML."""
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
    """Handle tool call requests for vendor listing."""
    if req.params.name != "list_vendors":
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Unknown tool: {req.params.name}",
                    )
                ],
                isError=True,
            )
        )

    arguments = req.params.arguments or {}
    try:
        payload = ListVendorsInput.model_validate(arguments)
    except ValidationError as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Input validation error: {exc.errors()}",
                    )
                ],
                isError=True,
            )
        )

    # Build query parameters
    endpoint = (
        f"https://vendors.talabat.com/api/v3/vendors"
        f"?lat={payload.lat}"
        f"&lon={payload.long}"
        f"&page={payload.page}"
        f"&size={payload.size}"
    )

    try:
        # Make API request
        response = await _make_api_request(endpoint)

        # Check for API errors
        if response.hasserror or response.result is None:
            error_message = "Unknown error"
            if response.error:
                if isinstance(response.error, dict):
                    error_message = response.error.get("msg", str(response.error))
                else:
                    error_message = str(response.error)
            
            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=f"Talabat API error: {error_message}",
                        )
                    ],
                    isError=True,
                )
            )

        # Structure data for UI component (convert to simplified format)
        simplified_vendors = []
        for vendor in response.result.restaurants:
            simplified_cuisines = [
                SimplifiedCuisine(
                    id=cuisine.id,
                    name=cuisine.na,
                    slug=cuisine.sl,
                )
                for cuisine in vendor.cus
            ]
            
            simplified_vendor = SimplifiedVendor(
                id=vendor.id,
                name=vendor.na,
                business_name=vendor.bna,
                rating=vendor.rat,
                rating_text=vendor.rtxt,
                delivery_time=vendor.avd,
                time_estimation=vendor.time_estimation,
                cuisines=simplified_cuisines,
                is_talabat_pro=vendor.is_tpro,
                logo=vendor.lg,
                cover_image=vendor.gtl,
                latitude=vendor.Lat,
                longitude=vendor.Lon,
            )
            simplified_vendors.append(simplified_vendor)

        structured_data = {
            "vendors": [vendor.model_dump() for vendor in simplified_vendors],
            "total_vendors": response.result.total_vendors,
            "base_url": response.base_url,
        }

        widget = WIDGETS_BY_ID["vendors-list"]
        meta = {
            **_tool_invocation_meta(widget),
            "location": {
                "lat": payload.lat,
                "long": payload.long,
            },
            "pagination": {
                "page": payload.page,
                "size": payload.size,
            },
            "lastSyncedAt": datetime.now().isoformat(),
        }

        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Found {len(response.result.restaurants)} vendors ({response.result.total_vendors} total available)",
                    )
                ],
                structuredContent=structured_data,
                _meta=meta,
            )
        )

    except httpx.HTTPError as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"API request failed: {str(exc)}",
                    )
                ],
                isError=True,
            )
        )
    except Exception as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Error processing request: {str(exc)}",
                    )
                ],
                isError=True,
            )
        )


# Step 03: Register request handlers
talabat_mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
talabat_mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource