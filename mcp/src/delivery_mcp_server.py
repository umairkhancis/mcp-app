"""Delivery.ae MCP server for food and grocery delivery functionality.

This server exposes tools for:
- Discovering nearby restaurants (Food Delivery)
- Browsing grocery/quick commerce items (Quick Delivery)

Both tools provide widget-backed UI components for rich rendering in ChatGPT.
This is a generic, brand-agnostic implementation."""

from __future__ import annotations

import os
import random
from abc import ABC, abstractmethod
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional, Protocol
from datetime import datetime

import mcp.types as types
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from pydantic import BaseModel, ConfigDict, Field, ValidationError


# =============================================================================
# STEP 1: Define Data Models (The Contract with TypeScript Widgets)
# =============================================================================

# -----------------------------------------------------------------------------
# Restaurant Models
# -----------------------------------------------------------------------------

class CuisineData(BaseModel):
    """Cuisine category for a restaurant."""
    id: str
    name: str
    slug: str


class RestaurantData(BaseModel):
    """Restaurant data model matching widget interface."""
    id: str
    name: str
    description: str
    rating: float
    review_count: int
    delivery_time_min: int
    delivery_time_max: int
    delivery_fee: float
    minimum_order: float
    cuisines: List[CuisineData]
    is_promoted: bool
    has_free_delivery: bool
    discount_percent: int
    logo_url: str
    cover_url: str
    latitude: float
    longitude: float
    distance_km: float
    is_open: bool


class RestaurantsToolOutput(BaseModel):
    """Output for list_nearby_restaurants tool."""
    restaurants: List[RestaurantData]
    total_count: int
    page: int
    has_more: bool
    location: Dict[str, Any]


# -----------------------------------------------------------------------------
# Quick Commerce Models
# -----------------------------------------------------------------------------

class CategoryData(BaseModel):
    """Product category for quick commerce."""
    id: str
    name: str
    slug: str
    icon: str
    item_count: int


class ProductData(BaseModel):
    """Product data model matching widget interface."""
    id: str
    name: str
    description: str
    price: float
    original_price: float
    currency: str
    unit: str
    quantity_available: int
    category_id: str
    category_name: str
    image_url: str
    is_promoted: bool
    is_new: bool
    discount_percent: int
    brand: str


class QuickToolOutput(BaseModel):
    """Output for list_quick_delivery_items tool."""
    products: List[ProductData]
    categories: List[CategoryData]
    total_count: int
    store_name: str
    delivery_time_min: int
    location: Dict[str, Any]


# =============================================================================
# STEP 2: Widget Configuration
# =============================================================================

@dataclass(frozen=True)
class DeliveryWidget:
    """Widget definition for Delivery UI components."""
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


# Widget definitions - Generic, brand-agnostic
widgets: List[DeliveryWidget] = [
    DeliveryWidget(
        identifier="list_nearby_restaurants",
        title="Nearby Restaurants",
        template_uri="ui://widget/delivery-restaurants.html",
        invoking="Finding restaurants near you...",
        invoked="Found nearby restaurants",
        html=_load_widget_html("delivery-restaurants"),
        response_text="Here are restaurants near you",
    ),
    DeliveryWidget(
        identifier="list_quick_delivery_items",
        title="Quick Delivery - Grocery & Essentials",
        template_uri="ui://widget/delivery-quick.html",
        invoking="Loading available items...",
        invoked="Items loaded successfully",
        html=_load_widget_html("delivery-quick"),
        response_text="Here are items available for quick delivery",
    ),
]

WIDGETS_BY_ID: Dict[str, DeliveryWidget] = {w.identifier: w for w in widgets}
WIDGETS_BY_URI: Dict[str, DeliveryWidget] = {w.template_uri: w for w in widgets}


# =============================================================================
# STEP 3: Input Schemas
# =============================================================================

class ListRestaurantsInput(BaseModel):
    """Input schema for list_nearby_restaurants tool."""
    lat: float = Field(..., description="Latitude coordinate for restaurant search")
    lng: float = Field(..., description="Longitude coordinate for restaurant search")
    page: int = Field(1, description="Page number for pagination (default: 1)")
    size: int = Field(10, description="Number of results per page (default: 10)")
    cuisine: Optional[str] = Field(None, description="Filter by cuisine type (optional)")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class ListQuickInput(BaseModel):
    """Input schema for list_quick_delivery_items tool."""
    lat: float = Field(..., description="Latitude coordinate for store search")
    lng: float = Field(..., description="Longitude coordinate for store search")
    category: Optional[str] = Field(None, description="Filter by category (optional)")

    model_config = ConfigDict(populate_by_name=True, extra="forbid")


RESTAURANTS_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "lat": {
            "type": "number",
            "description": "Latitude coordinate for restaurant search",
        },
        "lng": {
            "type": "number",
            "description": "Longitude coordinate for restaurant search",
        },
        "page": {
            "type": "number",
            "description": "Page number for pagination (default: 1)",
        },
        "size": {
            "type": "number",
            "description": "Number of results per page (default: 10)",
        },
        "cuisine": {
            "type": "string",
            "description": "Filter by cuisine type (optional)",
        },
    },
    "required": ["lat", "lng"],
    "additionalProperties": False,
}

QUICK_INPUT_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "properties": {
        "lat": {
            "type": "number",
            "description": "Latitude coordinate for store search",
        },
        "lng": {
            "type": "number",
            "description": "Longitude coordinate for store search",
        },
        "category": {
            "type": "string",
            "description": "Filter by category (optional)",
        },
    },
    "required": ["lat", "lng"],
    "additionalProperties": False,
}


# =============================================================================
# STEP 4: Data Provider Interface (Clean Architecture)
# =============================================================================

class RestaurantDataProvider(Protocol):
    """Interface for restaurant data providers."""
    
    def get_restaurants(
        self, lat: float, lng: float, page: int, size: int, cuisine: Optional[str]
    ) -> List[RestaurantData]:
        """Fetch restaurants based on location and filters."""
        ...


class ProductDataProvider(Protocol):
    """Interface for product data providers."""
    
    def get_products(
        self, lat: float, lng: float, category: Optional[str]
    ) -> tuple[List[ProductData], List[CategoryData]]:
        """Fetch products and categories based on location and filters."""
        ...


# =============================================================================
# STEP 5: Mock Data Providers (Implements Data Provider Interface)
# =============================================================================

class MockRestaurantDataProvider:
    """Mock implementation of restaurant data provider for demonstration."""
    
    def __init__(self):
        self._cuisines_data = [
            [CuisineData(id="1", name="Arabic", slug="arabic")],
            [CuisineData(id="2", name="Indian", slug="indian"), CuisineData(id="3", name="Pakistani", slug="pakistani")],
            [CuisineData(id="4", name="Italian", slug="italian"), CuisineData(id="5", name="Pizza", slug="pizza")],
            [CuisineData(id="6", name="Chinese", slug="chinese"), CuisineData(id="7", name="Asian", slug="asian")],
            [CuisineData(id="8", name="American", slug="american"), CuisineData(id="9", name="Burgers", slug="burgers")],
            [CuisineData(id="10", name="Japanese", slug="japanese"), CuisineData(id="11", name="Sushi", slug="sushi")],
            [CuisineData(id="12", name="Mexican", slug="mexican")],
            [CuisineData(id="13", name="Lebanese", slug="lebanese"), CuisineData(id="1", name="Arabic", slug="arabic")],
            [CuisineData(id="14", name="Thai", slug="thai"), CuisineData(id="7", name="Asian", slug="asian")],
            [CuisineData(id="15", name="Healthy", slug="healthy"), CuisineData(id="16", name="Salads", slug="salads")],
        ]
        
        self._restaurant_names = [
            ("Al Mallah", "Authentic Lebanese shawarma and grills", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=200"),
            ("Biryani Express", "Royal Hyderabadi biryani specialists", "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200"),
            ("Pizza Di Rocco", "Wood-fired Neapolitan pizzas", "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=200"),
            ("Dragon Palace", "Traditional Cantonese cuisine", "https://images.unsplash.com/photo-1525755662778-989d0524087e?w=200"),
            ("Shake Shack", "Premium burgers and shakes", "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200"),
            ("Sushi Lab", "Creative Japanese fusion rolls", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200"),
            ("Tacos El Paso", "Authentic Mexican street food", "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=200"),
            ("Zaatar W Zeit", "Fresh Lebanese manakish", "https://images.unsplash.com/photo-1579684947550-22e945225d9a?w=200"),
            ("Thai Orchid", "Aromatic Thai curries", "https://images.unsplash.com/photo-1562565652-a0d8f0c59eb4?w=200"),
            ("Protein House", "Healthy bowls and smoothies", "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200"),
            ("Kebab Factory", "Premium grilled kebabs", "https://images.unsplash.com/photo-1603360946369-dc9bb6258143?w=200"),
            ("Curry House", "North Indian delicacies", "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=200"),
        ]
    
    def get_restaurants(
        self, lat: float, lng: float, page: int, size: int, cuisine: Optional[str] = None
    ) -> List[RestaurantData]:
        """Generate mock restaurant data for demonstration."""
        restaurants = []
        start_idx = (page - 1) * size
        
        for i in range(size):
            idx = (start_idx + i) % len(self._restaurant_names)
            name, desc, logo = self._restaurant_names[idx]
            cuisine_idx = idx % len(self._cuisines_data)
            
            restaurant = RestaurantData(
                id=f"rest-{start_idx + i + 1}",
                name=name,
                description=desc,
                rating=round(random.uniform(3.5, 5.0), 1),
                review_count=random.randint(50, 2000),
                delivery_time_min=random.randint(15, 35),
                delivery_time_max=random.randint(35, 55),
                delivery_fee=round(random.uniform(0, 10), 0),
                minimum_order=round(random.uniform(20, 50), 0),
                cuisines=self._cuisines_data[cuisine_idx],
                is_promoted=(i < 2),
                has_free_delivery=(random.random() > 0.7),
                discount_percent=random.choice([0, 0, 0, 10, 15, 20, 25]),
                logo_url=logo,
                cover_url=logo.replace("w=200", "w=800"),
                latitude=lat + random.uniform(-0.05, 0.05),
                longitude=lng + random.uniform(-0.05, 0.05),
                distance_km=round(random.uniform(0.5, 5.0), 1),
                is_open=True,
            )
            restaurants.append(restaurant)
        
        return restaurants


class MockProductDataProvider:
    """Mock implementation of product data provider for demonstration."""
    
    def __init__(self):
        self._categories = [
            CategoryData(id="fruits", name="Fruits & Vegetables", slug="fruits-vegetables", icon="🥬", item_count=45),
            CategoryData(id="dairy", name="Dairy & Eggs", slug="dairy-eggs", icon="🥛", item_count=32),
            CategoryData(id="bakery", name="Bakery", slug="bakery", icon="🍞", item_count=28),
            CategoryData(id="beverages", name="Beverages", slug="beverages", icon="🥤", item_count=56),
            CategoryData(id="snacks", name="Snacks", slug="snacks", icon="🍿", item_count=67),
            CategoryData(id="frozen", name="Frozen Foods", slug="frozen", icon="🧊", item_count=41),
            CategoryData(id="household", name="Household", slug="household", icon="🧹", item_count=38),
            CategoryData(id="personal", name="Personal Care", slug="personal-care", icon="🧴", item_count=52),
        ]
        
        self._all_products = self._build_products()
    
    def _build_products(self) -> List[ProductData]:
        """Build the full product catalog."""
        return [
            # Fruits & Vegetables
            ProductData(id="p1", name="Fresh Bananas", description="Sweet ripe bananas", price=5.99, original_price=5.99, currency="AED", unit="1 kg", quantity_available=50, category_id="fruits", category_name="Fruits & Vegetables", image_url="https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=300", is_promoted=True, is_new=False, discount_percent=0, brand="Farm Fresh"),
            ProductData(id="p2", name="Organic Avocados", description="Perfectly ripe Hass avocados", price=12.99, original_price=15.99, currency="AED", unit="Pack of 3", quantity_available=30, category_id="fruits", category_name="Fruits & Vegetables", image_url="https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=300", is_promoted=False, is_new=True, discount_percent=19, brand="Organic Valley"),
            ProductData(id="p3", name="Red Tomatoes", description="Vine-ripened tomatoes", price=4.49, original_price=4.49, currency="AED", unit="500g", quantity_available=100, category_id="fruits", category_name="Fruits & Vegetables", image_url="https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Local Farm"),
            ProductData(id="p4", name="Fresh Spinach", description="Crisp baby spinach leaves", price=7.99, original_price=9.99, currency="AED", unit="200g", quantity_available=40, category_id="fruits", category_name="Fruits & Vegetables", image_url="https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=300", is_promoted=False, is_new=False, discount_percent=20, brand="Green Fields"),
            
            # Dairy & Eggs
            ProductData(id="p5", name="Fresh Milk", description="Full cream pasteurized milk", price=6.50, original_price=6.50, currency="AED", unit="1 Liter", quantity_available=80, category_id="dairy", category_name="Dairy & Eggs", image_url="https://images.unsplash.com/photo-1563636619-e9143da7973b?w=300", is_promoted=True, is_new=False, discount_percent=0, brand="Al Rawabi"),
            ProductData(id="p6", name="Free Range Eggs", description="Farm fresh free range eggs", price=15.99, original_price=15.99, currency="AED", unit="12 pieces", quantity_available=60, category_id="dairy", category_name="Dairy & Eggs", image_url="https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Happy Hens"),
            ProductData(id="p7", name="Greek Yogurt", description="Creamy strained yogurt", price=8.99, original_price=10.99, currency="AED", unit="500g", quantity_available=45, category_id="dairy", category_name="Dairy & Eggs", image_url="https://images.unsplash.com/photo-1488477181946-6428a0291777?w=300", is_promoted=False, is_new=True, discount_percent=18, brand="Chobani"),
            ProductData(id="p8", name="Cheddar Cheese", description="Mature cheddar cheese block", price=22.99, original_price=22.99, currency="AED", unit="400g", quantity_available=35, category_id="dairy", category_name="Dairy & Eggs", image_url="https://images.unsplash.com/photo-1618164436241-4473940d1f5c?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Kraft"),
            
            # Bakery
            ProductData(id="p9", name="Whole Wheat Bread", description="Fresh baked whole wheat loaf", price=5.50, original_price=5.50, currency="AED", unit="500g", quantity_available=25, category_id="bakery", category_name="Bakery", image_url="https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Bakers Delight"),
            ProductData(id="p10", name="Croissants", description="Buttery French croissants", price=12.99, original_price=14.99, currency="AED", unit="Pack of 4", quantity_available=20, category_id="bakery", category_name="Bakery", image_url="https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300", is_promoted=True, is_new=False, discount_percent=13, brand="Paul"),
            
            # Beverages
            ProductData(id="p11", name="Orange Juice", description="100% fresh squeezed orange juice", price=9.99, original_price=9.99, currency="AED", unit="1 Liter", quantity_available=70, category_id="beverages", category_name="Beverages", image_url="https://images.unsplash.com/photo-1621506289937-a8e4df240d0b?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Tropicana"),
            ProductData(id="p12", name="Mineral Water", description="Natural spring water", price=2.50, original_price=2.50, currency="AED", unit="1.5 Liter", quantity_available=200, category_id="beverages", category_name="Beverages", image_url="https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Evian"),
            ProductData(id="p13", name="Cold Brew Coffee", description="Premium cold brew coffee", price=14.99, original_price=18.99, currency="AED", unit="500ml", quantity_available=30, category_id="beverages", category_name="Beverages", image_url="https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300", is_promoted=False, is_new=True, discount_percent=21, brand="Starbucks"),
            
            # Snacks
            ProductData(id="p14", name="Mixed Nuts", description="Premium roasted mixed nuts", price=24.99, original_price=29.99, currency="AED", unit="500g", quantity_available=40, category_id="snacks", category_name="Snacks", image_url="https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=300", is_promoted=True, is_new=False, discount_percent=17, brand="Planters"),
            ProductData(id="p15", name="Potato Chips", description="Classic salted potato chips", price=7.99, original_price=7.99, currency="AED", unit="200g", quantity_available=90, category_id="snacks", category_name="Snacks", image_url="https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Lay's"),
            ProductData(id="p16", name="Dark Chocolate", description="72% cocoa dark chocolate", price=11.99, original_price=11.99, currency="AED", unit="100g", quantity_available=55, category_id="snacks", category_name="Snacks", image_url="https://images.unsplash.com/photo-1549007994-cb92caebd54b?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Lindt"),
            
            # Frozen Foods
            ProductData(id="p17", name="Frozen Pizza", description="Classic margherita frozen pizza", price=18.99, original_price=18.99, currency="AED", unit="400g", quantity_available=35, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=300", is_promoted=True, is_new=False, discount_percent=0, brand="Dr. Oetker"),
            ProductData(id="p18", name="Ice Cream Tub", description="Belgian chocolate ice cream", price=32.99, original_price=38.99, currency="AED", unit="1 Liter", quantity_available=25, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=300", is_promoted=False, is_new=False, discount_percent=15, brand="Häagen-Dazs"),
            ProductData(id="p19", name="Frozen Vegetables Mix", description="Garden vegetables medley", price=12.99, original_price=12.99, currency="AED", unit="500g", quantity_available=60, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1597362925123-77861d3fbac7?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Birds Eye"),
            ProductData(id="p20", name="Chicken Nuggets", description="Crispy breaded chicken nuggets", price=24.99, original_price=24.99, currency="AED", unit="500g", quantity_available=45, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1562967914-608f82629710?w=300", is_promoted=False, is_new=True, discount_percent=0, brand="Tyson"),
            ProductData(id="p21", name="Frozen Berries", description="Mixed berry blend for smoothies", price=19.99, original_price=24.99, currency="AED", unit="400g", quantity_available=30, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1425934398893-310a009a77f9?w=300", is_promoted=False, is_new=False, discount_percent=20, brand="Dole"),
            ProductData(id="p22", name="Fish Fingers", description="Cod fish fingers, omega-3 rich", price=21.99, original_price=21.99, currency="AED", unit="450g", quantity_available=40, category_id="frozen", category_name="Frozen Foods", image_url="https://images.unsplash.com/photo-1544376664-80b17f09d399?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Findus"),
            
            # Household
            ProductData(id="p23", name="Dish Soap", description="Lemon fresh dishwashing liquid", price=8.99, original_price=8.99, currency="AED", unit="750ml", quantity_available=80, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Fairy"),
            ProductData(id="p24", name="Laundry Detergent", description="Deep clean liquid detergent", price=34.99, original_price=39.99, currency="AED", unit="3 Liter", quantity_available=50, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1610557892470-55d9e80c0bce?w=300", is_promoted=True, is_new=False, discount_percent=13, brand="Persil"),
            ProductData(id="p25", name="Kitchen Towels", description="Ultra absorbent paper towels", price=15.99, original_price=15.99, currency="AED", unit="6 Rolls", quantity_available=70, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1583947215259-38e31be8751f?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Bounty"),
            ProductData(id="p26", name="Trash Bags", description="Heavy duty garbage bags", price=12.99, original_price=12.99, currency="AED", unit="30 Bags", quantity_available=90, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Glad"),
            ProductData(id="p27", name="All-Purpose Cleaner", description="Multi-surface cleaning spray", price=11.99, original_price=14.99, currency="AED", unit="500ml", quantity_available=55, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1563453392212-326f5e854473?w=300", is_promoted=False, is_new=True, discount_percent=20, brand="Dettol"),
            ProductData(id="p28", name="Toilet Paper", description="Soft 3-ply toilet tissue", price=24.99, original_price=24.99, currency="AED", unit="12 Rolls", quantity_available=100, category_id="household", category_name="Household", image_url="https://images.unsplash.com/photo-1584556812952-905ffd0c611a?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Charmin"),
            
            # Personal Care
            ProductData(id="p29", name="Shampoo", description="Moisturizing argan oil shampoo", price=28.99, original_price=28.99, currency="AED", unit="400ml", quantity_available=45, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1631729371254-42c2892f0e6e?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Pantene"),
            ProductData(id="p30", name="Body Wash", description="Refreshing citrus body wash", price=19.99, original_price=24.99, currency="AED", unit="500ml", quantity_available=60, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300", is_promoted=True, is_new=False, discount_percent=20, brand="Dove"),
            ProductData(id="p31", name="Toothpaste", description="Whitening mint toothpaste", price=12.99, original_price=12.99, currency="AED", unit="100ml", quantity_available=120, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1609840114035-3c981b782dfe?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Colgate"),
            ProductData(id="p32", name="Deodorant", description="48hr fresh protection", price=16.99, original_price=16.99, currency="AED", unit="150ml", quantity_available=75, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Nivea"),
            ProductData(id="p33", name="Hand Sanitizer", description="Antibacterial gel sanitizer", price=9.99, original_price=12.99, currency="AED", unit="250ml", quantity_available=150, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1584483766114-2cea6facdf57?w=300", is_promoted=False, is_new=False, discount_percent=23, brand="Purell"),
            ProductData(id="p34", name="Face Moisturizer", description="Hydrating daily face cream", price=45.99, original_price=55.99, currency="AED", unit="50ml", quantity_available=30, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1570194065650-d99fb4d8a609?w=300", is_promoted=False, is_new=True, discount_percent=18, brand="Neutrogena"),
            ProductData(id="p35", name="Razor Blades", description="5-blade precision razors", price=38.99, original_price=38.99, currency="AED", unit="Pack of 4", quantity_available=40, category_id="personal", category_name="Personal Care", image_url="https://images.unsplash.com/photo-1585751119414-ef2636f8aede?w=300", is_promoted=False, is_new=False, discount_percent=0, brand="Gillette"),
        ]
    
    def get_products(
        self, lat: float, lng: float, category: Optional[str] = None
    ) -> tuple[List[ProductData], List[CategoryData]]:
        """Get products and categories, optionally filtered by category."""
        if category:
            filtered_products = [p for p in self._all_products if p.category_id == category]
        else:
            filtered_products = self._all_products
        
        return filtered_products, self._categories


# =============================================================================
# STEP 6: Location Service
# =============================================================================

class LocationService:
    """Service for location-related operations."""
    
    @staticmethod
    def get_area_name(lat: float, lng: float) -> str:
        """Get area name based on coordinates (mock implementation)."""
        # Dubai coordinates check (simplified)
        if 25.0 <= lat <= 25.4 and 55.0 <= lng <= 55.5:
            areas = ["Downtown Dubai", "Dubai Marina", "JBR", "Business Bay", "DIFC", "Al Barsha"]
            return random.choice(areas)
        return "Your Area"


# =============================================================================
# STEP 7: FastMCP Server Setup
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


delivery_mcp = FastMCP(
    name="delivery-ae",
    stateless_http=True,
    transport_security=_transport_security_settings(),
)


# =============================================================================
# STEP 8: Metadata Helpers
# =============================================================================

def _tool_meta(widget: DeliveryWidget) -> Dict[str, Any]:
    """Generate tool metadata for OpenAI integration."""
    return {
        "openai/outputTemplate": widget.template_uri,
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
        "openai/widgetAccessible": True,
    }


def _tool_invocation_meta(widget: DeliveryWidget) -> Dict[str, Any]:
    """Generate invocation metadata for tool calls."""
    return {
        "openai/toolInvocation/invoking": widget.invoking,
        "openai/toolInvocation/invoked": widget.invoked,
    }


# =============================================================================
# STEP 9: Tool Handlers (Use Cases)
# =============================================================================

class ListRestaurantsHandler:
    """Handler for list_nearby_restaurants tool."""
    
    def __init__(
        self,
        restaurant_provider: RestaurantDataProvider,
        location_service: LocationService,
    ):
        self._restaurant_provider = restaurant_provider
        self._location_service = location_service
    
    async def handle(self, payload: ListRestaurantsInput) -> types.ServerResult:
        """Handle the list restaurants request."""
        widget = WIDGETS_BY_ID["list_nearby_restaurants"]
        
        try:
            restaurants = self._restaurant_provider.get_restaurants(
                payload.lat,
                payload.lng,
                payload.page,
                payload.size,
                payload.cuisine
            )
            
            area_name = self._location_service.get_area_name(payload.lat, payload.lng)
            total_count = 150  # Mock total
            
            structured_data = {
                "restaurants": [r.model_dump() for r in restaurants],
                "total_count": total_count,
                "page": payload.page,
                "has_more": (payload.page * payload.size) < total_count,
                "location": {
                    "lat": payload.lat,
                    "lng": payload.lng,
                    "area_name": area_name,
                },
            }

            meta = {
                **_tool_invocation_meta(widget),
                "location": {
                    "lat": payload.lat,
                    "lng": payload.lng,
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
                            text=f"Found {len(restaurants)} restaurants near {area_name} ({total_count} total available)",
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


class ListQuickItemsHandler:
    """Handler for list_quick_delivery_items tool."""
    
    def __init__(
        self,
        product_provider: ProductDataProvider,
        location_service: LocationService,
    ):
        self._product_provider = product_provider
        self._location_service = location_service
    
    async def handle(self, payload: ListQuickInput) -> types.ServerResult:
        """Handle the list quick items request."""
        widget = WIDGETS_BY_ID["list_quick_delivery_items"]
        
        try:
            products, categories = self._product_provider.get_products(
                payload.lat,
                payload.lng,
                payload.category
            )
            
            area_name = self._location_service.get_area_name(payload.lat, payload.lng)
            delivery_time = random.randint(10, 20)
            
            structured_data = {
                "products": [p.model_dump() for p in products],
                "categories": [c.model_dump() for c in categories],
                "total_count": len(products),
                "store_name": "Quick Delivery",
                "delivery_time_min": delivery_time,
                "location": {
                    "lat": payload.lat,
                    "lng": payload.lng,
                    "area_name": area_name,
                },
            }

            meta = {
                **_tool_invocation_meta(widget),
                "location": {
                    "lat": payload.lat,
                    "lng": payload.lng,
                },
                "category": payload.category,
                "lastSyncedAt": datetime.now().isoformat(),
            }

            return types.ServerResult(
                types.CallToolResult(
                    content=[
                        types.TextContent(
                            type="text",
                            text=f"Found {len(products)} items - {delivery_time} min delivery to {area_name}",
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


# =============================================================================
# STEP 10: Initialize Handlers with Dependencies
# =============================================================================

# Initialize data providers
_restaurant_provider = MockRestaurantDataProvider()
_product_provider = MockProductDataProvider()
_location_service = LocationService()

# Initialize handlers with dependencies (Dependency Injection)
_restaurants_handler = ListRestaurantsHandler(_restaurant_provider, _location_service)
_quick_items_handler = ListQuickItemsHandler(_product_provider, _location_service)


# =============================================================================
# STEP 11: MCP Protocol Handlers
# =============================================================================

@delivery_mcp._mcp_server.list_tools()
async def _list_tools() -> List[types.Tool]:
    """List all available tools."""
    return [
        types.Tool(
            name="list_nearby_restaurants",
            title="Nearby Restaurants",
            description="Find nearby restaurants for food delivery. Returns a list of restaurants with ratings, delivery times, cuisines, and special offers.",
            inputSchema=deepcopy(RESTAURANTS_INPUT_SCHEMA),
            _meta=_tool_meta(WIDGETS_BY_ID["list_nearby_restaurants"]),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        ),
        types.Tool(
            name="list_quick_delivery_items",
            title="Quick Delivery - Grocery & Essentials",
            description="Browse grocery and essential items for quick delivery. Filter by category to find what you need.",
            inputSchema=deepcopy(QUICK_INPUT_SCHEMA),
            _meta=_tool_meta(WIDGETS_BY_ID["list_quick_delivery_items"]),
            annotations={
                "destructiveHint": False,
                "openWorldHint": False,
                "readOnlyHint": True,
            },
        ),
    ]


@delivery_mcp._mcp_server.list_resources()
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


@delivery_mcp._mcp_server.list_resource_templates()
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


async def _call_tool_request(req: types.CallToolRequest) -> types.ServerResult:
    """Handle tool call requests - routes to appropriate handler."""
    arguments = req.params.arguments or {}
    
    if req.params.name == "list_nearby_restaurants":
        try:
            payload = ListRestaurantsInput.model_validate(arguments)
        except ValidationError as exc:
            return types.ServerResult(
                types.CallToolResult(
                    content=[types.TextContent(type="text", text=f"Input validation error: {exc.errors()}")],
                    isError=True,
                )
            )
        return await _restaurants_handler.handle(payload)
    
    elif req.params.name == "list_quick_delivery_items":
        try:
            payload = ListQuickInput.model_validate(arguments)
        except ValidationError as exc:
            return types.ServerResult(
                types.CallToolResult(
                    content=[types.TextContent(type="text", text=f"Input validation error: {exc.errors()}")],
                    isError=True,
                )
            )
        return await _quick_items_handler.handle(payload)
    
    else:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=f"Unknown tool: {req.params.name}")],
                isError=True,
            )
        )


# =============================================================================
# STEP 12: Register Request Handlers
# =============================================================================

delivery_mcp._mcp_server.request_handlers[types.CallToolRequest] = _call_tool_request
delivery_mcp._mcp_server.request_handlers[types.ReadResourceRequest] = _handle_read_resource
