"""Quick test script for the Ideate MCP server

This script verifies that the server can be imported and initialized correctly.
"""

import asyncio
import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


async def test_server_initialization():
    """Test that the server initializes correctly."""
    print("Testing Ideate MCP server initialization...")

    try:
        from src.ideate_server import mcp, IDEATE_API_BASE, VERSIONED_URIS
        print("✓ Successfully imported ideate_server module")

        # Check that tools are registered
        tools = list(mcp._tools.keys()) if hasattr(mcp, '_tools') else []
        print(f"✓ Registered tools: {len(tools) if tools else 'checking...'}")

        # Check that resources are registered
        resources = list(mcp._resources.keys()) if hasattr(mcp, '_resources') else []
        print(f"✓ Registered resources: {len(resources) if resources else 'checking...'}")

        print(f"✓ API Base URL: {IDEATE_API_BASE}")
        print(f"✓ Widget URIs:")
        for key, uri in VERSIONED_URIS.items():
            print(f"  - {key}: {uri}")

        print("\n✅ Server initialization test passed!")
        return True

    except Exception as e:
        print(f"\n❌ Server initialization test failed!")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_app_initialization():
    """Test that the FastAPI app initializes correctly."""
    print("\nTesting FastAPI app initialization...")

    try:
        from src.ideate_app import app
        print("✓ Successfully imported ideate_app module")
        print(f"✓ App title: {app.title}")
        print(f"✓ App version: {app.version}")

        # Check routes
        routes = [route.path for route in app.routes]
        print(f"✓ Registered routes: {len(routes)}")
        for route in routes:
            print(f"  - {route}")

        print("\n✅ FastAPI app initialization test passed!")
        return True

    except Exception as e:
        print(f"\n❌ FastAPI app initialization test failed!")
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main():
    """Run all tests."""
    print("=" * 60)
    print("Ideate MCP Server Test Suite")
    print("=" * 60)

    server_ok = await test_server_initialization()
    app_ok = await test_app_initialization()

    print("\n" + "=" * 60)
    if server_ok and app_ok:
        print("✅ All tests passed!")
        print("=" * 60)
        return 0
    else:
        print("❌ Some tests failed!")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
