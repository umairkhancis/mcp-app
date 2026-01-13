import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # Server Port
    PORT: int = int(os.environ.get("PORT", 5000))

    # Tavily API Key
    TAVILY_API_KEY: str = os.environ.get("TAVILY_API_KEY", "")

    # OAuth Protected Resource Metadata JSON
    OAUTH_PROTECTED_RESOURCE_METADATA_JSON: str = os.environ.get("OAUTH_PROTECTED_RESOURCE_METADATA_JSON", "")

    def __post_init__(self):
        if not self.PORT:
            raise ValueError("PORT environment variable not set")
        if not self.TAVILY_API_KEY:
            raise ValueError("TAVILY_API_KEY environment variable not set")
        if not self.OAUTH_PROTECTED_RESOURCE_METADATA_JSON:
            raise ValueError("OAUTH_PROTECTED_RESOURCE_METADATA_JSON environment variable not set")


settings = Settings()
