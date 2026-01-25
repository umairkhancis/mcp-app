"""Property Finder MCP server for real estate property search functionality.

This server exposes tools for:
- Searching rental properties in Dubai
- Searching properties for sale in Dubai
- Filtering by property type, bedrooms, location, and purpose

Provides widget-backed UI components for rich rendering in ChatGPT."""

from __future__ import annotations

import os
import random
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, ValidationError


# =============================================================================
# STEP 1: Define Data Models (The Contract with TypeScript Widgets)
# =============================================================================

class LocationData(BaseModel):
    """Location data for a property."""
    area_name: str
    city: str
    lat: float
    lng: float


class AgentData(BaseModel):
    """Real estate agent data."""
    name: str
    company: str
    phone: str
    image_url: str


class PropertyData(BaseModel):
    """Property data model matching widget interface."""
    id: str
    title: str
    description: str
    property_type: str  # apartment, villa, townhouse, commercial
    purpose: str  # rent, buy
    price: float
    currency: str
    price_period: Optional[str] = None  # monthly, yearly for rentals
    bedrooms: int
    bathrooms: int
    size_sqft: int
    location: LocationData
    amenities: List[str]
    image_urls: List[str]
    agent: AgentData
    is_featured: bool
    is_verified: bool
    listing_date: str


class FilterOption(BaseModel):
    """Filter option for dropdowns."""
    id: str
    label: str


class PropertyFinderToolOutput(BaseModel):
    """Output for search_properties tool."""
    properties: List[PropertyData]
    total_count: int
    filters_applied: Dict[str, Any]
    available_locations: List[FilterOption]


# =============================================================================
# STEP 2: Widget Configuration
# =============================================================================

@dataclass(frozen=True)
class PropertyFinderWidget:
    """Widget definition for Property Finder UI components."""
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
widgets: List[PropertyFinderWidget] = [
    PropertyFinderWidget(
        identifier="search_properties",
        title="Property Finder - Search Properties",
        template_uri="ui://widget/property-finder.html",
        invoking="Searching for properties...",
        invoked="Found properties",
        html=_load_widget_html("property-finder"),
        response_text="Here are properties matching your search",
    ),
]

WIDGETS_BY_ID: Dict[str, PropertyFinderWidget] = {w.identifier: w for w in widgets}
WIDGETS_BY_URI: Dict[str, PropertyFinderWidget] = {w.template_uri: w for w in widgets}


# =============================================================================
# STEP 3: Input Schemas
# =============================================================================

class SearchPropertiesInput(BaseModel):
    """Input schema for search_properties tool."""
    purpose: Optional[str] = Field(None, description="Property purpose: 'rent' for rental properties or 'buy' for properties for sale. If not specified, returns both.")
    location: Optional[str] = Field(None, description="Dubai area name (e.g., 'Dubai Marina', 'Downtown Dubai', 'JBR', 'Palm Jumeirah', 'Dubai South', 'Business Bay')")
    property_type: Optional[str] = Field(None, description="Property type: 'apartment', 'villa', 'townhouse', or 'commercial'")
    bedrooms: Optional[int] = Field(None, description="Number of bedrooms (1-5)")
    min_price: Optional[float] = Field(None, description="Minimum price in AED")
    max_price: Optional[float] = Field(None, description="Maximum price in AED")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


SEARCH_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "purpose": {
            "type": "string",
            "description": "Property purpose: 'rent' for rental properties or 'buy' for properties for sale. If not specified, returns both.",
            "enum": ["rent", "buy"],
        },
        "location": {
            "type": "string",
            "description": "Dubai area name (e.g., 'Dubai Marina', 'Downtown Dubai', 'JBR', 'Palm Jumeirah', 'Dubai South', 'Business Bay')",
        },
        "property_type": {
            "type": "string",
            "description": "Property type: 'apartment', 'villa', 'townhouse', or 'commercial'",
            "enum": ["apartment", "villa", "townhouse", "commercial"],
        },
        "bedrooms": {
            "type": "number",
            "description": "Number of bedrooms (1-5)",
        },
        "min_price": {
            "type": "number",
            "description": "Minimum price in AED",
        },
        "max_price": {
            "type": "number",
            "description": "Maximum price in AED",
        },
    },
    "required": [],
    "additionalProperties": False,
}


# =============================================================================
# STEP 4: FastMCP Server Setup
# =============================================================================

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


property_finder_mcp = FastMCP(
    name="property-finder",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)


# =============================================================================
# STEP 5: Metadata Helpers
# =============================================================================

def _tool_meta(widget: PropertyFinderWidget) -> Dict[str, Any]:
    """Generate tool metadata for OpenAI integration."""
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
    }


def _tool_invocation_meta(widget: PropertyFinderWidget) -> Dict[str, Any]:
    """Generate invocation metadata for tool calls."""
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }


# =============================================================================
# STEP 6: Dubai Location Data
# =============================================================================

DUBAI_LOCATIONS = [
    {"name": "Dubai Marina", "lat": 25.0805, "lng": 55.1403},
    {"name": "Downtown Dubai", "lat": 25.1972, "lng": 55.2744},
    {"name": "JBR", "lat": 25.0762, "lng": 55.1328},
    {"name": "Palm Jumeirah", "lat": 25.1124, "lng": 55.1390},
    {"name": "Dubai South", "lat": 24.8962, "lng": 55.1665},
    {"name": "Business Bay", "lat": 25.1851, "lng": 55.2619},
    {"name": "DIFC", "lat": 25.2096, "lng": 55.2795},
    {"name": "Dubai Hills Estate", "lat": 25.1021, "lng": 55.2355},
    {"name": "Arabian Ranches", "lat": 25.0576, "lng": 55.2667},
    {"name": "Jumeirah Village Circle", "lat": 25.0548, "lng": 55.2095},
    {"name": "Al Barsha", "lat": 25.1032, "lng": 55.2000},
    {"name": "Deira", "lat": 25.2697, "lng": 55.3094},
    {"name": "Bur Dubai", "lat": 25.2532, "lng": 55.2906},
    {"name": "Mirdif", "lat": 25.2274, "lng": 55.4207},
    {"name": "Motor City", "lat": 25.0450, "lng": 55.2350},
]

AVAILABLE_LOCATIONS: List[FilterOption] = [
    FilterOption(id=loc["name"], label=loc["name"]) for loc in DUBAI_LOCATIONS
]


# =============================================================================
# STEP 7: Mock Data Generators
# =============================================================================

REAL_ESTATE_AGENTS = [
    AgentData(name="Ahmed Hassan", company="Emirates Properties", phone="+971 50 123 4567", image_url="https://randomuser.me/api/portraits/men/32.jpg"),
    AgentData(name="Sarah Johnson", company="Dubai Luxury Homes", phone="+971 50 234 5678", image_url="https://randomuser.me/api/portraits/women/44.jpg"),
    AgentData(name="Mohammad Al Rashid", company="Golden Gate Real Estate", phone="+971 50 345 6789", image_url="https://randomuser.me/api/portraits/men/52.jpg"),
    AgentData(name="Emma Williams", company="Prime Properties Dubai", phone="+971 50 456 7890", image_url="https://randomuser.me/api/portraits/women/28.jpg"),
    AgentData(name="Omar Khalid", company="Bayut Properties", phone="+971 50 567 8901", image_url="https://randomuser.me/api/portraits/men/22.jpg"),
    AgentData(name="Fatima Al Maktoum", company="Royal Estates", phone="+971 50 678 9012", image_url="https://randomuser.me/api/portraits/women/56.jpg"),
    AgentData(name="James Wilson", company="Hamptons International", phone="+971 50 789 0123", image_url="https://randomuser.me/api/portraits/men/62.jpg"),
    AgentData(name="Aisha Patel", company="Property Finder Elite", phone="+971 50 890 1234", image_url="https://randomuser.me/api/portraits/women/67.jpg"),
]

PROPERTY_AMENITIES = [
    ["Pool", "Gym", "Parking", "Security", "Balcony"],
    ["Beach Access", "Concierge", "Spa", "Kids Play Area", "BBQ Area"],
    ["Private Garden", "Maid's Room", "Study", "Laundry Room", "Storage"],
    ["Covered Parking", "Central A/C", "Built-in Wardrobes", "Intercom", "CCTV"],
    ["Rooftop Terrace", "Smart Home", "Walk-in Closet", "Kitchen Appliances", "Pets Allowed"],
]

PROPERTY_IMAGES = {
    "apartment": [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800",
        "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800",
        "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800",
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800",
        "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?w=800",
    ],
    "villa": [
        "https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800",
        "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800",
        "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800",
        "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800",
    ],
    "townhouse": [
        "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800",
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800",
        "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800",
        "https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800",
        "https://images.unsplash.com/photo-1599809275671-b5942cabc7a2?w=800",
    ],
    "commercial": [
        "https://images.unsplash.com/photo-1497366216548-37526070297c?w=800",
        "https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=800",
        "https://images.unsplash.com/photo-1604328698692-f76ea9498e76?w=800",
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
        "https://images.unsplash.com/photo-1462826303086-329426d1aef5?w=800",
    ],
}

PROPERTY_TITLES = {
    "apartment": [
        "Luxurious {bedrooms}BR Apartment with Sea View",
        "Modern {bedrooms}BR Apartment in Prime Location",
        "Stunning {bedrooms} Bedroom Apartment with Balcony",
        "Spacious {bedrooms}BR Apartment with City Views",
        "Elegant {bedrooms} Bedroom Apartment with Marina View",
        "Contemporary {bedrooms}BR Apartment near Metro",
        "Premium {bedrooms} Bedroom Apartment with Pool View",
        "Bright {bedrooms}BR Apartment with Open Layout",
    ],
    "villa": [
        "Magnificent {bedrooms}BR Villa with Private Pool",
        "Exclusive {bedrooms} Bedroom Villa with Garden",
        "Stunning {bedrooms}BR Villa in Gated Community",
        "Luxurious {bedrooms} Bedroom Villa with Landscaped Garden",
        "Grand {bedrooms}BR Villa with Golf Course View",
        "Contemporary {bedrooms} Bedroom Villa with Smart Home",
        "Elegant {bedrooms}BR Family Villa with Maid's Room",
        "Premium {bedrooms} Bedroom Villa near School",
    ],
    "townhouse": [
        "Beautiful {bedrooms}BR Townhouse with Terrace",
        "Modern {bedrooms} Bedroom Townhouse in Community",
        "Spacious {bedrooms}BR Townhouse with Garden",
        "Family-friendly {bedrooms} Bedroom Townhouse",
        "Corner {bedrooms}BR Townhouse with Extra Space",
        "Upgraded {bedrooms} Bedroom Townhouse near Park",
        "Brand New {bedrooms}BR Townhouse Ready to Move",
        "Charming {bedrooms} Bedroom Townhouse with View",
    ],
    "commercial": [
        "Premium Office Space - {size} sqft",
        "Retail Shop in Prime Location - {size} sqft",
        "Commercial Space with High Visibility - {size} sqft",
        "Grade A Office in Business District - {size} sqft",
        "Shop Space near Metro Station - {size} sqft",
        "Warehouse Space for Rent - {size} sqft",
        "Restaurant Space with Kitchen - {size} sqft",
        "Showroom Space in Mall - {size} sqft",
    ],
}


def _generate_property(
    idx: int,
    purpose: Optional[str],
    location_name: str,
    property_type: str,
    bedrooms: Optional[int],
) -> PropertyData:
    """Generate a single mock property."""
    
    # Randomly assign purpose if not specified
    actual_purpose = purpose if purpose else random.choice(["rent", "buy"])
    
    # Get location data
    location_data = next((loc for loc in DUBAI_LOCATIONS if loc["name"] == location_name), DUBAI_LOCATIONS[0])
    
    # Generate bedrooms for the property type
    if bedrooms:
        num_bedrooms = bedrooms
    elif property_type == "commercial":
        num_bedrooms = 0
    elif property_type == "villa":
        num_bedrooms = random.choice([3, 4, 5, 6])
    elif property_type == "townhouse":
        num_bedrooms = random.choice([2, 3, 4])
    else:  # apartment
        num_bedrooms = random.choice([1, 2, 3, 4])
    
    # Generate size based on property type and bedrooms
    if property_type == "commercial":
        size_sqft = random.randint(500, 5000)
    elif property_type == "villa":
        size_sqft = random.randint(2500, 8000)
    elif property_type == "townhouse":
        size_sqft = random.randint(1500, 3500)
    else:  # apartment
        size_sqft = random.randint(500, 2500)
    
    # Generate price based on purpose, type, and size
    if actual_purpose == "rent":
        if property_type == "commercial":
            price = random.randint(50000, 500000)  # Yearly
        elif property_type == "villa":
            price = random.randint(150000, 800000)  # Yearly
        elif property_type == "townhouse":
            price = random.randint(80000, 300000)  # Yearly
        else:  # apartment
            price = random.randint(40000, 250000)  # Yearly
        price_period = "yearly"
    else:  # buy
        if property_type == "commercial":
            price = random.randint(1000000, 20000000)
        elif property_type == "villa":
            price = random.randint(2000000, 50000000)
        elif property_type == "townhouse":
            price = random.randint(1500000, 8000000)
        else:  # apartment
            price = random.randint(500000, 10000000)
        price_period = None
    
    # Select title template
    title_templates = PROPERTY_TITLES.get(property_type, PROPERTY_TITLES["apartment"])
    title_template = random.choice(title_templates)
    title = title_template.format(bedrooms=num_bedrooms, size=size_sqft)
    
    # Generate description
    if property_type == "commercial":
        description = f"Prime {property_type} space in {location_name}. This {size_sqft} sqft space offers excellent visibility and is ideal for businesses looking for a strategic location in Dubai."
    else:
        description = f"Beautiful {num_bedrooms} bedroom {property_type} located in the heart of {location_name}. This {size_sqft} sqft property features modern finishes, ample natural light, and stunning views. Perfect for families or professionals looking for a comfortable home in one of Dubai's most sought-after locations."
    
    # Select images
    images = PROPERTY_IMAGES.get(property_type, PROPERTY_IMAGES["apartment"])
    selected_images = random.sample(images, min(3, len(images)))
    
    # Select amenities
    amenities_set = random.sample(PROPERTY_AMENITIES, 2)
    amenities = list(set([item for sublist in amenities_set for item in sublist]))[:6]
    
    # Select agent
    agent = random.choice(REAL_ESTATE_AGENTS)
    
    # Generate listing date
    days_ago = random.randint(1, 60)
    listing_date = (datetime.now() - timedelta(days=days_ago)).isoformat()
    
    return PropertyData(
        id=f"prop-{idx + 1}",
        title=title,
        description=description,
        property_type=property_type,
        purpose=actual_purpose,
        price=price,
        currency="AED",
        price_period=price_period,
        bedrooms=num_bedrooms,
        bathrooms=max(1, num_bedrooms - 1) if property_type != "commercial" else 1,
        size_sqft=size_sqft,
        location=LocationData(
            area_name=location_name,
            city="Dubai",
            lat=location_data["lat"] + random.uniform(-0.01, 0.01),
            lng=location_data["lng"] + random.uniform(-0.01, 0.01),
        ),
        amenities=amenities,
        image_urls=selected_images,
        agent=agent,
        is_featured=random.random() < 0.2,
        is_verified=random.random() < 0.7,
        listing_date=listing_date,
    )


def _generate_mock_properties(
    purpose: Optional[str] = None,
    location: Optional[str] = None,
    property_type: Optional[str] = None,
    bedrooms: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
) -> List[PropertyData]:
    """Generate mock property data for demonstration.
    
    If purpose is not specified, generates a random mix of rent and buy properties.
    """
    
    properties = []
    
    # Determine locations to generate properties for
    if location:
        # Find matching location (case-insensitive partial match)
        matching_locations = [
            loc["name"] for loc in DUBAI_LOCATIONS
            if location.lower() in loc["name"].lower()
        ]
        if not matching_locations:
            matching_locations = [DUBAI_LOCATIONS[0]["name"]]
    else:
        matching_locations = [loc["name"] for loc in DUBAI_LOCATIONS]
    
    # Determine property types to generate
    if property_type:
        property_types = [property_type]
    else:
        property_types = ["apartment", "villa", "townhouse", "commercial"]
    
    # Generate properties
    idx = 0
    for loc in matching_locations[:3]:  # Limit to 3 locations
        for ptype in property_types:
            # Generate 2-4 properties per location/type combination
            num_properties = random.randint(2, 4)
            for _ in range(num_properties):
                # Pass purpose to generate_property - if None, it will randomly assign
                prop = _generate_property(idx, purpose, loc, ptype, bedrooms)
                
                # Apply price filters
                if min_price and prop.price < min_price:
                    continue
                if max_price and prop.price > max_price:
                    continue
                
                properties.append(prop)
                idx += 1
    
    # Sort by featured first, then by listing date
    properties.sort(key=lambda p: (not p.is_featured, p.listing_date), reverse=True)
    
    return properties[:20]  # Limit to 20 properties


# =============================================================================
# STEP 8: MCP Protocol Handlers
# =============================================================================

@property_finder_mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    """List all available tools."""
    return [
        types.Tool(
            name="search_properties",
            title="Property Finder - Search Properties",
            description="Search for properties in Dubai for rent or sale. Filter by location (Dubai Marina, Downtown Dubai, JBR, Palm Jumeirah, Dubai South, Business Bay, etc.), property type (apartment, villa, townhouse, commercial), number of bedrooms, and price range.",
            inputSchema=deepcopy(SEARCH_INPUT_SCHEMA),
            _meta=_tool_meta(WIDGETS_BY_ID["search_properties"]),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        ),
    ]


@property_finder_mcp._mcp_server.list_resources()
async def _list_resources() -> List[types.Resource]:
    """List all available resources (widget HTML)."""
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


@property_finder_mcp._mcp_server.list_resource_templates()
async def _list_resource_templates() -> List[types.ResourceTemplate]:
    """List all available resource templates."""
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


async def _handle_search_properties(payload: SearchPropertiesInput) -> types.ServerResult:
    """Handle search_properties tool call."""
    widget = WIDGETS_BY_ID["search_properties"]
    
    try:
        # Generate mock property data (purpose is now optional - will generate mix if None)
        properties = _generate_mock_properties(
            purpose=payload.purpose,
            location=payload.location,
            property_type=payload.property_type,
            bedrooms=payload.bedrooms,
            min_price=payload.min_price,
            max_price=payload.max_price,
        )
        
        # Build filters applied dict (only include non-None values)
        filters_applied = {}
        if payload.purpose:
            filters_applied["purpose"] = payload.purpose
        if payload.location:
            filters_applied["location"] = payload.location
        if payload.property_type:
            filters_applied["property_type"] = payload.property_type
        if payload.bedrooms:
            filters_applied["bedrooms"] = payload.bedrooms
        
        structured_data = {
            "properties": [p.model_dump() for p in properties],
            "total_count": len(properties),
            "filters_applied": filters_applied,
            "available_locations": [loc.model_dump() for loc in AVAILABLE_LOCATIONS],
        }

        meta = {
            **_tool_invocation_meta(widget),
            "filters": filters_applied,
            "lastSyncedAt": datetime.now().isoformat(),
        }

        # Build response text
        if payload.purpose:
            purpose_text = "rental" if payload.purpose == "rent" else "for sale"
        else:
            purpose_text = "for rent and sale"
        location_text = f" in {payload.location}" if payload.location else " in Dubai"
        type_text = f" {payload.property_type}s" if payload.property_type else " properties"
        
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text=f"Found {len(properties)}{type_text} {purpose_text}{location_text}",
                    )
                ],
                structuredContent=structured_data,
                _meta=meta,
            )
        )

    except Exception as exc:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Error: {str(exc)}")],
                isError=True,
            )
        )


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    """Handle tool call requests - routes to appropriate handler."""
    arguments = req.params.arguments or {}
    
    if req.params.name == "search_properties":
        try:
            payload = SearchPropertiesInput.model_validate(arguments)
        except ValidationError as exc:
            return types.ServerResult(
                types.CallToolResult(
                    content=[types.TextContent(type="text", text=f"Input validation error: {exc.errors()}")],
                    isError=True,
                )
            )
        return await _handle_search_properties(payload)
    
    else:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Unknown tool: {req.params.name}")],
                isError=True,
            )
        )


# =============================================================================
# STEP 9: Register Request Handlers
# =============================================================================

property_finder_mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
property_finder_mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource
