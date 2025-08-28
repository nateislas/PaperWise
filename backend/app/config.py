from pydantic_settings import BaseSettings
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)

class Settings(BaseSettings):
    # API Configuration
    api_title: str = "PaperWise API"
    api_version: str = "1.0.0"
    debug: bool = False
    
    # Llama Configuration
    llama_api_key: Optional[str] = None
    llama_base_url: str = "https://api.llama.com/compat/v1/"
    llama_model: str = "Llama-4-Maverick-17B-128E-Instruct-FP8"
    llama_temperature: float = 0.1
    
    # Performance & Streaming Configuration
    enable_streaming: bool = True
    stream_chunk_size: int = 50  # Reasonable chunk size for responsive streaming
    request_timeout: int = 300  # 5 minutes
    connection_timeout: int = 30  # 30 seconds
    max_concurrent_requests: int = 10
    
    # Vector Database Configuration
    chroma_persist_directory: str = "./chroma_db"
    
    # File Upload Configuration
    upload_dir: str = "uploads"
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    
    # Analysis Configuration
    chunk_size: int = 1000
    chunk_overlap: int = 200
    max_tokens_per_request: int = 4000
    
    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: Optional[str] = None
    celery_result_backend: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = False

# Create settings instance
settings = Settings()

# Validate required settings
def validate_settings():
    if not settings.llama_api_key:
        raise ValueError("LLAMA_API_KEY environment variable is required")
    
    # Create necessary directories
    os.makedirs(settings.upload_dir, exist_ok=True)
    os.makedirs(settings.chroma_persist_directory, exist_ok=True)
    
    # Default Celery config from redis_url if not provided
    if not settings.celery_broker_url:
        settings.celery_broker_url = settings.redis_url
    if not settings.celery_result_backend:
        settings.celery_result_backend = settings.redis_url

# Call validation on import
try:
    validate_settings()
except ValueError as e:
    logger.error(f"Configuration error: {e}")
    logger.error("Please check your .env file and ensure all required variables are set.")
