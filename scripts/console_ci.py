"""Run real frontend integration inside the job's rootless DinD, never on its VM.

Reuse the audited Core bridge's TLS preflight, safe source/artifact handling and
completion verification. Core itself remains unmodified.
"""

import argparse
import importlib.util
import subprocess
import tarfile
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def source(archive, folder, prefix):
    result = subprocess.run(
        ["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
        cwd=folder,
        capture_output=True,
        check=True,
    )
    for filename in result.stdout.decode().strip("\0").split("\0"):
        if not filename:
            continue
        file = folder / filename
        if (
            file.is_symlink()
            or not file.resolve().is_relative_to(folder)
            or not file.is_file()
        ):
            raise RuntimeError("Unsafe source entry")
        if file.name != ".env.example" and (
            file.name.startswith(".env")
            or file.suffix
            in {".pem", ".key", ".pfx", ".p12", ".xpkg", ".private", ".dump"}
        ):
            raise RuntimeError("Refusing private input in the CI source archive")
        info = archive.gettarinfo(str(file), arcname=prefix + "/" + filename)
        info.uid = info.gid = 0
        info.uname = info.gname = ""
        with file.open("rb") as stream:
            archive.addfile(info, stream)


def git_identity(archive, folder, prefix):
    """Keep verifiable Core HEAD, without clone credentials, hooks or reflogs."""
    git = folder / ".git"
    if not git.is_dir() or git.is_symlink():
        raise RuntimeError("A regular audited Core checkout is required")
    directories = {git}
    files = []
    for entry in ("HEAD", "index", "shallow", "packed-refs", "objects", "refs"):
        item = git / entry
        if item.is_dir():
            directories.add(item)
            for child in item.rglob("*"):
                if child.is_symlink():
                    raise RuntimeError("Unsafe Git identity entry")
                if child.is_dir():
                    directories.add(child)
                else:
                    files.append(child)
        elif item.exists():
            files.append(item)
    # Packed detached CI refs may be empty; Git still requires these directories.
    for file in [*sorted(directories), *files]:
        if file.is_symlink() or not file.resolve().is_relative_to(git):
            raise RuntimeError("Unsafe Git identity entry")
        info = archive.gettarinfo(
            str(file), arcname=prefix + "/" + file.relative_to(folder).as_posix()
        )
        info.uid = info.gid = 0
        info.uname = info.gname = ""
        if file in directories:
            archive.addfile(info)
        else:
            with file.open("rb") as stream:
                archive.addfile(info, stream)
    config = b"[core]\nrepositoryformatversion = 0\nbare = false\n"
    info = tarfile.TarInfo(prefix + "/.git/config")
    info.mode = 0o600
    info.size = len(config)
    import io

    archive.addfile(info, io.BytesIO(config))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", type=Path, required=True)
    parser.add_argument("--erp", type=Path, required=True)
    args = parser.parse_args()
    core = args.core.resolve()
    erp = args.erp.resolve()
    spec = importlib.util.spec_from_file_location(
        "core_docker_bridge", core / "scripts/docker_job.py"
    )
    bridge = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bridge)
    bridge.preflight()
    name = "xarionix-console-ci-" + uuid.uuid4().hex
    base = name + "-core-toolbox"
    image = name + "-browser"
    created = False
    try:
        print("Building the disposable Core + browser toolbox", flush=True)
        bridge.command(
            [
                "docker",
                "build",
                "-f",
                str(core / "deploy/ci/Dockerfile"),
                "-t",
                base,
                str(core),
            ],
            capture=False,
            timeout=1200,
        )
        bridge.command(
            [
                "docker",
                "build",
                "-f",
                str(ROOT / "deploy/console/e2e.Dockerfile"),
                "--build-arg",
                "CORE_TOOLBOX=" + base,
                "-t",
                image,
                str(ROOT),
            ],
            capture=False,
            timeout=1200,
        )
        bridge.command(
            [
                "docker",
                "volume",
                "create",
                "--label",
                "io.xarionix.console-ci=" + name,
                name,
            ]
        )
        mount = (
            bridge.command(
                ["docker", "volume", "inspect", "--format", "{{.Mountpoint}}", name]
            )
            .stdout.decode()
            .strip()
        )
        if not mount.startswith("/") or not mount.endswith("/" + name + "/_data"):
            raise RuntimeError("Unexpected isolated workspace path")
        bridge.command(
            [
                "docker",
                "create",
                "--name",
                name,
                "--network",
                "host",
                "--security-opt",
                "no-new-privileges:true",
                "--mount",
                f"type=volume,source={name},target={mount}",
                "--mount",
                f"type=bind,source={bridge.ROOTLESS_SOCKET},target={bridge.ROOTLESS_SOCKET}",
                "--env",
                "DOCKER_HOST=unix://" + bridge.ROOTLESS_SOCKET,
                "--env",
                "DOCKER_TLS_VERIFY=",
                "--env",
                "DOCKER_CERT_PATH=",
                "--env",
                "TMPDIR=" + mount + "/tmp",
                "--env",
                "CI=true",
                "--workdir",
                mount + "/web",
                image,
                "sh",
                "scripts/console-ci-inner.sh",
            ]
        )
        created = True
        with tempfile.TemporaryFile() as stream:
            with tarfile.open(fileobj=stream, mode="w") as archive:
                source(archive, ROOT, "web")
                source(archive, core, "core")
                source(archive, erp, "erp")
                git_identity(archive, core, "core")
            stream.seek(0)
            bridge.command(
                ["docker", "cp", "--archive", "-", name + ":" + mount], stdin=stream
            )
        bridge.command(["docker", "start", name])
        try:
            bridge.wait_for_controller(name, "Console integration", timeout=2400)
        finally:
            with tempfile.TemporaryFile() as stream:
                copied = bridge.command(
                    ["docker", "cp", name + ":" + mount + "/web/reports/.", "-"],
                    stdout=stream,
                    check=False,
                )
                if copied.returncode == 0:
                    stream.seek(0)
                    bridge.restore_artifacts(
                        stream, ROOT / "reports", {"console-e2e.xml"}
                    )
    finally:
        if created:
            bridge.command(["docker", "rm", "--force", name], check=False)
        bridge.command(["docker", "volume", "rm", name], check=False)
        bridge.command(["docker", "image", "rm", image, base], check=False)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, ValueError, OSError, subprocess.SubprocessError):
        raise SystemExit(
            "Console integration bridge failed; inspect the last reported phase (no credential output)"
        ) from None
