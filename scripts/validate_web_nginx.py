"""Validate the public HTTPS routing with disposable certificates, never deployment secrets."""

import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IMAGE = "nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03"


def main():
    (ROOT / ".ci-tmp").mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="web-nginx-", dir=ROOT / ".ci-tmp") as directory:
        temporary = Path(directory)
        tls = temporary / "tls"
        tls.mkdir()
        subprocess.run(
            ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "1",
             "-subj", "/CN=xarionix.example.test", "-keyout", str(tls / "web.key"),
             "-out", str(tls / "web.crt")],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        # The CI controller uses umask 077. Nginx needs to traverse the bind-mounted
        # directory and read both generated files. The private parent stays 0700.
        tls.chmod(0o755)
        for name in ("web.crt", "web.key"):
            (tls / name).chmod(0o644)
        config = (ROOT / "deploy/web/nginx.conf.example").read_text()
        (temporary / "nginx.conf").write_text("pid /tmp/nginx.pid;\nerror_log /dev/stderr warn;\nevents {}\nhttp {\n" + config + "\n}\n")
        (temporary / "nginx.conf").chmod(0o644)
        result = subprocess.run(
            ["docker", "run", "--rm", "--network", "none", "--read-only", "--cap-drop", "ALL",
             "--security-opt", "no-new-privileges:true", "--tmpfs", "/tmp:rw,noexec,nosuid,uid=101,gid=101,mode=0700,size=16m",
             "--tmpfs", "/var/cache/nginx:rw,noexec,nosuid,uid=101,gid=101,mode=0700,size=16m",
             "--add-host", "core.example.test:127.0.0.1",
             "--add-host", "erp.example.test:127.0.0.1",
             "--mount", f"type=bind,source={temporary / 'nginx.conf'},target=/etc/nginx/nginx.conf,readonly",
             "--mount", f"type=bind,source={tls},target=/etc/nginx/tls,readonly",
             "--entrypoint", "nginx", IMAGE, "-t", "-c", "/etc/nginx/nginx.conf"],
            capture_output=True, timeout=180,
        )
        if result.returncode:
            raise RuntimeError("Public Web nginx -t failed (disposable inputs): " + result.stderr.decode(errors="replace")[:2000])
        print("Unified Web HTTPS routing: nginx -t passed (disposable certificates)")


if __name__ == "__main__":
    main()
