import json
import logging

from fastapi import HTTPException, Request
from fastapi.security import HTTPBearer
from fastapi.responses import JSONResponse

from scalekit import ScalekitClient
from scalekit.common.scalekit import TokenValidationOptions
from starlette.middleware.base import BaseHTTPMiddleware

from .config import config

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Security scheme for Bearer token
security = HTTPBearer()

# Initialize ScaleKit client
scalekit_client = ScalekitClient(
    config.AUTH_PROVIDER_ENVIRONMENT_URL,
    config.AUTH_PROVIDER_CLIENT_ID,
    config.AUTH_PROVIDER_CLIENT_SECRET
)

# Authentication middleware
class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):

        # Do not authenticate OAuth Protected Resource Metadata endpoint
        if request.url.path.startswith("/.well-known/"):
            return await call_next(request)

        try:
            auth_header = request.headers.get("Authorization")

            # Throw 401 error, if authorization header is missing else continue
            if not auth_header or not auth_header.startswith("Bearer "):
                logger.error("Missing or invalid authorization header")
                raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

            token = auth_header.split(" ")[1]

            request_body = await request.body()
            
            # Parse JSON from bytes
            try:
                request_data = json.loads(request_body.decode('utf-8'))
            except (json.JSONDecodeError, UnicodeDecodeError):
                request_data = {}
            
            validation_options = TokenValidationOptions(
              issuer=config.AUTH_PROVIDER_ENVIRONMENT_URL,
              audience=[config.AUTH_PROVIDER_AUDIENCE],
            )
            
            is_tool_call = request_data.get("method") == "tools/call"
            
            required_scopes = []
            if is_tool_call:
                required_scopes = ["search:read"] # get required scope for your tool
                validation_options.required_scopes = required_scopes  
            
            try:
                scalekit_client.validate_token(token, options=validation_options)
                
            except Exception as e:
                logger.error(f"Token validation failed with error: {e}")
                raise HTTPException(status_code=401, detail="Token validation failed")

        except HTTPException as e:
            logger.error(f"HTTPException: {e}")
            return JSONResponse(
                status_code=e.status_code,
                content={"error": "unauthorized" if e.status_code == 401 else "forbidden", "error_description": e.detail},
                headers={
                    "WWW-Authenticate": f'Bearer realm="OAuth", resource_metadata="{config.OAUTH_PROTECTED_RESOURCE_METADATA_URL}"'
                }
            )

        return await call_next(request)