import hashlib
import io
from minio import Minio
from minio.error import S3Error

from app.core.config import settings


class StorageService:
    def __init__(self):
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self._ensure_bucket()

    def _ensure_bucket(self):
        if not self.client.bucket_exists(settings.minio_bucket):
            self.client.make_bucket(settings.minio_bucket)

    def upload_file(self, file_data: bytes, storage_path: str, content_type: str = "application/octet-stream") -> str:
        data = io.BytesIO(file_data)
        self.client.put_object(
            settings.minio_bucket,
            storage_path,
            data,
            length=len(file_data),
            content_type=content_type,
        )
        return storage_path

    def download_file(self, storage_path: str) -> bytes:
        response = self.client.get_object(settings.minio_bucket, storage_path)
        data = response.read()
        response.close()
        response.release_conn()
        return data

    def delete_file(self, storage_path: str):
        self.client.remove_object(settings.minio_bucket, storage_path)

    def file_exists(self, storage_path: str) -> bool:
        try:
            self.client.stat_object(settings.minio_bucket, storage_path)
            return True
        except S3Error:
            return False

    @staticmethod
    def compute_hash(file_data: bytes) -> str:
        return hashlib.sha256(file_data).hexdigest()

    @staticmethod
    def build_storage_path(file_hash: str, original_filename: str) -> str:
        ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "bin"
        return f"{file_hash[:2]}/{file_hash[2:4]}/{file_hash}.{ext}"


storage_service = StorageService()
