import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Server Port
    HOST: str = os.environ.get("HOST", "localhost")
    PORT: int = int(os.environ.get("PORT", 5000))

    # Tavily API Key
    TAVILY_API_KEY: str = os.environ.get("TAVILY_API_KEY", "")

    # Resource configuration
    RESOURCE: str = os.environ.get("RESOURCE", "")
    OAUTH_PROTECTED_RESOURCE_METADATA_URL: str = os.environ.get("OAUTH_PROTECTED_RESOURCE_METADATA_URL", "")
    OAUTH_PROTECTED_RESOURCE_METADATA_JSON: str = os.environ.get("OAUTH_PROTECTED_RESOURCE_METADATA_JSON", "")

    # Auth Provider Configurations i.e. Scalekit
    AUTH_PROVIDER_ENVIRONMENT_URL: str = os.environ.get("AUTH_PROVIDER_ENVIRONMENT_URL", "")
    AUTH_PROVIDER_CLIENT_ID: str = os.environ.get("AUTH_PROVIDER_CLIENT_ID", "")
    AUTH_PROVIDER_CLIENT_SECRET: str = os.environ.get("AUTH_PROVIDER_CLIENT_SECRET", "")

    AUTH_PROVIDER_AUDIENCE: str = os.environ.get("AUTH_PROVIDER_AUDIENCE", "")

    def __post_init__(self):
        if not self.HOST:
            raise ValueError("HOST environment variable not set")
        if not self.PORT:
            raise ValueError("PORT environment variable not set")
        if not self.TAVILY_API_KEY:
            raise ValueError("TAVILY_API_KEY environment variable not set")
        if not self.RESOURCE:
            raise ValueError("RESOURCE environment variable not set")
        if not self.OAUTH_PROTECTED_RESOURCE_METADATA_URL:
            raise ValueError("OAUTH_PROTECTED_RESOURCE_METADATA_URL environment variable not set")
        if not self.OAUTH_PROTECTED_RESOURCE_METADATA_JSON:
            raise ValueError("OAUTH_PROTECTED_RESOURCE_METADATA_JSON environment variable not set")
        if not self.SCALEKIT_ENVIRONMENT_URL:
            raise ValueError("AUTH_PROVIDER_ENVIRONMENT_URL environment variable not set")
        if not self.AUTH_PROVIDER_CLIENT_ID:
            raise ValueError("AUTH_PROVIDER_CLIENT_ID environment variable not set")
        if not self.AUTH_PROVIDER_CLIENT_SECRET:
            raise ValueError("AUTH_PROVIDER_CLIENT_SECRET environment variable not set")
        if not self.AUTH_PROVIDER_AUDIENCE:
            raise ValueError("AUTH_SERVER_AUDIENCE environment variable not set")


config = Config()
