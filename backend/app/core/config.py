from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://docuvault:docuvault@localhost:5433/docuvault"
    meilisearch_url: str = "http://localhost:7700"
    meilisearch_key: str = "docuvault-master-key"
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "docuvault"
    minio_secret_key: str = "docuvault-secret"
    minio_bucket: str = "documents"
    minio_secure: bool = False
    anthropic_api_key: str = ""
    redis_url: str = "redis://localhost:6379/0"
    watch_dir: str = "./watch"
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    class Config:
        env_file = ".env"


settings = Settings()
