from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    delivery_pg_dsn: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_secure: bool = False
    minio_bucket_photos: str = "parts-photos"
    minio_bucket_waybills: str = "delivery-photos"
    minio_photo_prefix: str = "delivery/parcels"
    minio_public_base: str

    admin_login: str
    admin_password: str
    forwarder_login: str
    forwarder_password: str
    session_ttl_days: int = 30
    cookie_secure: bool = False
    cookie_name: str = "delivery_session"

    api_port: int = 8002
    web_origin: str = "http://localhost:3000"


settings = Settings()
