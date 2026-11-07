"""Disposable ERP compatibility fixture for real shared-session browser tests.

Separate PostgreSQL/Redis, existing ERP setup + explicit trusted bindings.
No access to developer databases, production data or Core SQL credentials.
"""
import os
import secrets
import subprocess
import sys
from pathlib import Path


class ErpFixture:
    def __init__(self, source, folder, issuer, core_url, web_client, port):
        self.source, self.folder = source, folder
        self.port, self.process = port(), None
        self.pg_port, self.redis_port = port(), port()
        self.password = secrets.token_hex(32)
        self.environment = {k: os.environ[k] for k in ("PATH", "LANG", "HOME", "TMPDIR") if k in os.environ} | {
            "PYTHONPATH": str(source / "app"), "HOST": "127.0.0.1", "PORT": str(self.port),
            "POSTGRES_USER": "erp_fixture", "POSTGRES_PASSWORD": self.password, "POSTGRES_DB": "erp_fixture",
            "DATABASE_URL": f"postgresql+psycopg://erp_fixture:{self.password}@127.0.0.1:{self.pg_port}/erp_fixture",
            "REDIS_HOST": "127.0.0.1", "REDIS_PORT": str(self.redis_port), "REDIS_PASSWORD": self.password, "REDIS_DB": "0",
            "JWT_SECRET": secrets.token_hex(32), "JWT_ALGORITHM": "HS256", "JWT_ACCESS_TOKEN_EXPIRE_MINUTES": "15",
            "REFRESH_TOKEN_EXPIRE_DAYS": "30", "REFRESH_COOKIE_NAME": "fixture_erp", "COOKIE_SECURE": "false",
            "SYSTEM_ADMIN_USERNAME": "fixture-operator", "SYSTEM_ADMIN_PASSWORD": secrets.token_urlsafe(32),
            "MAP_TILES_ENABLED": "false", "PLATFORM_OIDC_ENABLED": "true", "PLATFORM_DEVELOPMENT": "true",
            "PLATFORM_CORE_API": core_url + "/api/v1", "PLATFORM_OIDC_ISSUER": issuer, "PLATFORM_OIDC_CLIENT_ID": web_client,
        }
        self.python = source / ".venv/bin/python"
        if not self.python.is_file():
            raise RuntimeError("Install the ERP test virtualenv before shared-session integration")
        self.base_url = f"http://localhost:{self.port}"

    def services(self):
        return {
            "erp-postgres": {
                "image": "postgres:18.6", "restart": "no",
                "environment": {"POSTGRES_USER": "erp_fixture", "POSTGRES_PASSWORD": self.password, "POSTGRES_DB": "erp_fixture"},
                "ports": [f"127.0.0.1:{self.pg_port}:5432"],
                "tmpfs": ["/var/lib/postgresql:rw,nosuid,size=768m"],
                "healthcheck": {"test": ["CMD-SHELL", "pg_isready -U erp_fixture -d erp_fixture"], "interval": "1s", "timeout": "5s", "retries": 60},
            },
            "erp-redis": {
                "image": "redis:8.4.2-alpine", "restart": "no",
                "command": ["redis-server", "--save", "", "--appendonly", "no", "--requirepass", self.password],
                "ports": [f"127.0.0.1:{self.redis_port}:6379"],
                "environment": {"REDISCLI_AUTH": self.password},
                "healthcheck": {"test": ["CMD", "redis-cli", "ping"], "interval": "1s", "timeout": "5s", "retries": 60},
            },
        }

    def start(self, wait):
        self.process = subprocess.Popen([str(self.python), "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", str(self.port), "--no-access-log"],
            cwd=self.source, env=self.environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        wait(self.base_url + "/health", timeout=90)
        import httpx
        with httpx.Client(trust_env=False, timeout=10) as client:
            result = client.post(self.base_url + "/api/v1/setup/initialize", json={"company": {"name": "ERP fixture", "short_name": "ERP"}})
            if result.status_code != 201:
                raise RuntimeError("Disposable ERP setup failed (no credential output)")
            self.company = result.json()["company_id"]
        import psycopg
        with psycopg.connect(host="127.0.0.1", port=self.pg_port, dbname="erp_fixture",
                user="erp_fixture", password=self.password) as connection:
            self.user = connection.execute("SELECT id FROM users WHERE username=%s", ("fixture-operator",)).fetchone()[0]

    def bind(self, user_id, subject, company_id):
        from uuid import UUID
        for args in (
            ["user", "--core-id", str(UUID(user_id)), "--erp-id", str(self.user), "--subject", str(UUID(subject)), "--allow-system-admin"],
            ["company", "--core-id", str(UUID(company_id)), "--erp-id", str(self.company)],
        ):
            result = subprocess.run([str(self.python), "-m", "tools.platform_bindings", *args], cwd=self.source, env=self.environment, capture_output=True, timeout=30)
            if result.returncode:
                raise RuntimeError("Explicit disposable ERP binding failed (no credential output)")

    def close(self):
        if self.process is not None:
            self.process.terminate()
            try:
                self.process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                self.process.kill(); self.process.wait(timeout=5)
