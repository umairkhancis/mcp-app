import contextlib
import uvicorn

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings

from .mcp_server import mcp

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

# Create and mount the MCP server with authentication
mcp_server = mcp.streamable_http_app()
# app.add_middleware(AuthMiddleware)
app.mount("/", mcp_server)

def main():
    """Main entry point for the MCP server."""
    uvicorn.run(app, host="localhost", port=settings.PORT, log_level="debug")


if __name__ == "__main__":
    main()
