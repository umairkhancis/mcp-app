"""Test script for Talabat API requests."""

import asyncio
import json
from talabat_mcp_server import _make_api_request


async def test_vendors_api():
    """Test the vendors API endpoint."""
    # Using Dubai, UAE coordinates (25.2048, 55.2708)
    endpoint = "https://vendors.talabat.com/api/v3/vendors?lat=25.2048&lon=55.2708&page=1&size=5"
    
    print(f"Making request to: {endpoint}\n")
    
    try:
        # Make the API request
        data = await _make_api_request(endpoint)
        
        # Print the response data
        print("✓ Request successful!")
        print(f"\nTimestamp: {data.timestamp}")
        print(f"Has Error: {data.hasserror}")
        
        if data.hasserror or data.result is None:
            print(f"\n❌ API Error: {data.error}")
            return
            
        print(f"Base URL: {data.base_url}")
        print(f"\nTotal Vendors: {data.result.total_vendors}")
        print(f"Vendors Returned: {len(data.result.restaurants)}")
        print(f"Trending Vendors: {len(data.result.trending_vendors)}")
        print(f"Top Rated Vendors: {len(data.result.top_rated_vendors)}")
        
        # Print details of each vendor
        print("\n" + "="*80)
        print("VENDOR DETAILS")
        print("="*80)
        for idx, vendor in enumerate(data.result.restaurants, 1):
            print(f"\n{idx}. {vendor.na}")
            print(f"   Business Name: {vendor.bna}")
            print(f"   Rating: {vendor.rat} ({vendor.rtxt})")
            print(f"   Delivery Time: {vendor.avd}")
            print(f"   Time Estimation: {vendor.time_estimation}")
            print(f"   Talabat Pro: {vendor.is_tpro}")
            print(f"   Cuisines: {', '.join([c.na for c in vendor.cus])}")
            print(f"   Location: ({vendor.Lat}, {vendor.Lon})")
        
        # Print raw JSON (pretty printed)
        print("\n" + "="*80)
        print("RAW JSON RESPONSE")
        print("="*80)
        print(json.dumps(data.model_dump(), indent=2, default=str))
        
    except Exception as exc:
        print(f"✗ Request failed: {exc}")
        raise


if __name__ == "__main__":
    asyncio.run(test_vendors_api())

