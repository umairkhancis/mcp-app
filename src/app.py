import contextlib
import uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings

from .mcp_server import mcp

from fastapi.responses import JSONResponse

import json

# Create a combined lifespan to manage the MCP session manager


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    async with mcp.session_manager.run():
        yield

app = FastAPI(lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Specify actual origins in production
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "healthy", "message": "Application is running"}

# OAuth Protected Resource Metadata endpoint - Required for MCP client discovery
# Copy the actual authorization server URL and metadata from your Scalekit dashboard.
# The values shown here are examples - replace with your actual configuration.
@app.get('/.well-known/oauth-protected-resource')
async def get_oauth_protected_resource():
    response = json.loads(settings.OAUTH_PROTECTED_RESOURCE_METADATA_JSON)
    return response

# Create and mount the MCP server
mcp_server = mcp.streamable_http_app()
app.mount("/", mcp_server)


def main():
    """Main entry point for the MCP server."""
    uvicorn.run(app, host="localhost", port=settings.PORT, log_level="debug")


if __name__ == "__main__":
    main()
