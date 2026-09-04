import os
from fastapi import Security, HTTPException, status
from fastapi.security import APIKeyHeader

API_KEY_NAME = "X-API-Key"
api_key_header = APIKeyHeader(name=API_KEY_NAME, auto_error=False)

# Load API keys from environment variable (comma-separated)
# e.g. API_KEYS="secret_key_1,secret_key_2"
# If no keys are set, API key authentication is disabled
API_KEYS = [key.strip() for key in os.getenv("API_KEYS", "").split(",") if key.strip()]

async def verify_api_key(api_key: str = Security(api_key_header)):
    # If no API keys are configured, allow access
    if not API_KEYS:
        return None
        
    # Validate the key
    if api_key in API_KEYS:
        return api_key
        
    # Raise unauthorized error if key is invalid/missing
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Could not validate credentials: Invalid or missing X-API-Key header."
    )
