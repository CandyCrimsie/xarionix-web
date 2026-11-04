"""Disposable real Core/PG/Keycloak + browser OIDC. No installed dev/prod volumes.

Run with the Core dev virtualenv; the sibling Core checkout is read-only input.
Credentials stay in a private temporary directory, never in artifacts or argv.
"""

import argparse
import base64
import copy
import json
import os
import re
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def port():
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def write(path, value, mode=0o600):
    path.write_text(value, encoding="utf-8")
    path.chmod(mode)


def run(command, *, env=None, timeout=900):
    result = subprocess.run(
        command, cwd=ROOT, env=env, capture_output=True, timeout=timeout, check=False
    )
    if result.returncode:
        # Never echo Docker expanded config, SQL or credential-bearing stderr.
        raise RuntimeError(
            f"Test infrastructure command failed: {Path(command[0]).name} (exit {result.returncode})"
        )
    return result.stdout


def wait_for(url, timeout=420):
    import httpx

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            if httpx.get(url, timeout=5, trust_env=False).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(0.5)
    raise RuntimeError("Disposable service readiness timeout")


def browser_realm(setup, config, users):
    realm = setup.realm(config, development=True)
    client = realm["clients"][1]
    client["clientId"] = "xarionix-console"
    client["defaultClientScopes"] = ["basic", "profile", "email", "acr"]
    client["attributes"] |= {
        "post.logout.redirect.uris": config["BROWSER_ORIGIN"] + "/auth/logged-out",
        "acr.loa.map": json.dumps({"urn:xarionix:mfa": 2}),
        "default.acr.values": "urn:xarionix:mfa",
    }
    realm["browserFlow"] = "console-browser"

    def execution(authenticator, priority, requirement="REQUIRED", **extra):
        return {
            "authenticator": authenticator,
            "priority": priority,
            "requirement": requirement,
            "authenticatorFlow": False,
            "userSetupAllowed": False,
            **extra,
        }

    realm["authenticationFlows"] = [
        {
            "alias": "console-browser",
            "providerId": "basic-flow",
            "topLevel": True,
            "builtIn": False,
            "authenticationExecutions": [
                execution("auth-cookie", 10, "ALTERNATIVE"),
                {
                    "flowAlias": "console-forms",
                    "priority": 20,
                    "requirement": "ALTERNATIVE",
                    "authenticatorFlow": True,
                    "userSetupAllowed": False,
                },
            ],
        },
        {
            "alias": "console-forms",
            "providerId": "basic-flow",
            "topLevel": False,
            "builtIn": False,
            "authenticationExecutions": [
                execution("auth-username-password-form", 10),
                {
                    "flowAlias": "console-mfa",
                    "priority": 20,
                    "requirement": "CONDITIONAL",
                    "authenticatorFlow": True,
                    "userSetupAllowed": False,
                },
            ],
        },
        {
            "alias": "console-mfa",
            "providerId": "basic-flow",
            "topLevel": False,
            "builtIn": False,
            "authenticationExecutions": [
                execution(
                    "conditional-level-of-authentication",
                    10,
                    authenticatorConfig="console-loa2",
                ),
                execution("auth-otp-form", 20),
            ],
        },
    ]
    realm["authenticatorConfig"] = [
        {
            "alias": "console-loa2",
            "config": {"loa-condition-level": "2", "loa-max-age": "0"},
        }
    ]
    realm["users"] = [
        {
            "id": u["subject"],
            "username": name,
            "enabled": True,
            "emailVerified": True,
            "firstName": name.capitalize(),
            "lastName": "Console",
            "email": name + "@example.test",
            "credentials": [
                {"type": "password", "value": u["password"], "temporary": False},
                {
                    "id": str(uuid.uuid4()),
                    "type": "otp",
                    "secretData": json.dumps({"value": u["otp"]}),
                    "credentialData": json.dumps(
                        {
                            "digits": 6,
                            "counter": 0,
                            "period": 30,
                            "algorithm": "HmacSHA1",
                            "subType": "totp",
                        }
                    ),
                },
            ],
        }
        for name, u in users.items()
    ]
    return realm


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--core", type=Path, default=ROOT.parent / "xarionix-core")
    parser.add_argument(
        "--keep",
        action="store_true",
        help="Keep the isolated test stack until Ctrl-C, not production data",
    )
    parser.add_argument("--smoke", action="store_true")
    parser.add_argument(
        "--runtime-socket",
        type=Path,
        help="An explicitly selected EMPTY dedicated rootless daemon; never the Core-stack daemon",
    )
    args = parser.parse_args()
    core = args.core.resolve()
    if not (core / "app/main.py").is_file():
        raise RuntimeError("Provide a real xarionix-core checkout with --core")
    sys.path[:0] = [str(core), str(core / "tests")]
    import httpx
    import psycopg
    import yaml
    from psycopg import sql
    from runtime_helpers import runtime_package

    from scripts import setup

    run(["docker", "info", "--format", "{{.ServerVersion}}"])
    runtime_info = None
    if args.runtime_socket:
        args.runtime_socket = args.runtime_socket.resolve(strict=True)
        with httpx.Client(
            transport=httpx.HTTPTransport(uds=str(args.runtime_socket)),
            base_url="http://engine",
            trust_env=False,
        ) as client:
            runtime_info = client.get("/info").json()
        outer = run(["docker", "info", "--format", "{{.ID}}"]).decode().strip()
        if (
            runtime_info.get("ID") == outer
            or runtime_info.get("Containers") != 0
            or "name=rootless" not in runtime_info.get("SecurityOptions", [])
            or str(runtime_info.get("CgroupVersion")) != "2"
            or not all(
                runtime_info.get(k) is True
                for k in ("MemoryLimit", "SwapLimit", "PidsLimit", "CpuCfsQuota")
            )
        ):
            raise RuntimeError(
                "Refusing a shared/nonempty/non-delegated runtime engine"
            )
    os.umask(0o077)
    folder = Path(tempfile.mkdtemp(prefix="xarionix-console-test-"))
    project = "xarionix-console-test-" + uuid.uuid4().hex[:12]
    web_port, core_port, kc_port, pg_port = port(), port(), port(), port()
    users = {
        name: {
            "password": secrets.token_urlsafe(24),
            "otp": base64.b32encode(secrets.token_bytes(20)).decode().rstrip("="),
            "subject": str(uuid.uuid4()),
            "identity_id": str(uuid.uuid4()),
            "user_id": str(uuid.uuid4()),
        }
        for name in ("admin", "member", "outsider")
    }
    config = (
        setup.DEFAULTS
        | {key: secrets.token_hex(32) for key in setup.SECRETS}
        | {
            "PUBLIC_URL": f"http://localhost:{core_port}",
            "KEYCLOAK_PUBLIC_URL": f"http://localhost:{kc_port}",
            "OIDC_ISSUER": f"http://localhost:{kc_port}/realms/xarionix",
            "BROWSER_ORIGIN": f"http://localhost:{web_port}",
            "BROWSER_REDIRECT_URI": f"http://localhost:{web_port}/auth/callback",
        }
    )
    definition = yaml.safe_load((core / "compose.dev.yaml").read_text())
    services = definition["services"]
    bootstrap = folder / "10-app-user.sh"
    write(bootstrap, (core / "deploy/postgres/10-app-user.sh").read_text(), 0o755)
    deployment_secret = secrets.token_hex(32)
    realm_data = browser_realm(setup, config, users)
    realm_data["clients"].append(
        {
            "clientId": "console-deployment",
            "enabled": True,
            "protocol": "openid-connect",
            "publicClient": False,
            "secret": deployment_secret,
            "serviceAccountsEnabled": True,
            "standardFlowEnabled": False,
            "directAccessGrantsEnabled": False,
            "defaultClientScopes": ["basic"],
            "optionalClientScopes": [],
            "protocolMappers": [
                {
                    "name": "deployment-audience",
                    "protocol": "openid-connect",
                    "protocolMapper": "oidc-audience-mapper",
                    "config": {
                        "included.custom.audience": "xarionix-core-deployment",
                        "access.token.claim": "true",
                        "id.token.claim": "false",
                    },
                },
                {
                    "name": "deployment-purpose",
                    "protocol": "openid-connect",
                    "protocolMapper": "oidc-hardcoded-claim-mapper",
                    "config": {
                        "claim.name": "xarionix_principal",
                        "claim.value": "deployment",
                        "jsonType.label": "String",
                        "access.token.claim": "true",
                        "id.token.claim": "false",
                    },
                },
            ],
        }
    )
    realm_path = folder / "realm.json"
    write(realm_path, json.dumps(realm_data), 0o644)
    for name in ("postgres", "keycloak-postgres"):
        services[name]["volumes"][1]["source"] = str(bootstrap)
    services["postgres"]["ports"] = [f"127.0.0.1:{pg_port}:5432"]
    services["keycloak"]["ports"] = [f"127.0.0.1:{kc_port}:8080"]
    services["keycloak"]["environment"]["KC_HOSTNAME"] = config["KEYCLOAK_PUBLIC_URL"]
    services["keycloak"]["volumes"][0]["source"] = str(realm_path)
    image = "xarionix-console-core-test:" + project
    for name in ("core", "migrate"):
        services[name]["image"] = image
        services[name]["environment"] |= {
            "XARIONIX_PUBLIC_URL": config["PUBLIC_URL"],
            "XARIONIX_OIDC_ISSUER": config["OIDC_ISSUER"],
            "XARIONIX_ADMIN_ACR_VALUES": '["urn:xarionix:mfa"]',
            "XARIONIX_ADMIN_AUTH_MAX_AGE_SECONDS": "900",
        }
    services["core"]["build"] = str(core)
    services["core"]["ports"] = [f"127.0.0.1:{core_port}:8000"]
    # Separate trusted executor credentials, never mounted into Angular or used by Core HTTP.
    executor_user = "console_installer_" + uuid.uuid4().hex[:8]
    executor_password = secrets.token_hex(32)
    services["trusted-executor"] = copy.deepcopy(services["core"])
    services["trusted-executor"].pop("build", None)
    services["trusted-executor"].pop("ports", None)
    services["trusted-executor"].pop("healthcheck", None)
    services["trusted-executor"]["profiles"] = ["operator-only"]
    services["trusted-executor"]["environment"] |= {
        "XARIONIX_DB_USER": executor_user,
        "XARIONIX_DB_PASSWORD": executor_password,
    }
    services["trusted-executor"]["restart"] = "no"
    for service in services.values():
        service["labels"] = {"io.xarionix.console-test": project}
    compose_file, env_file = folder / "compose.yaml", folder / ".env"
    write(compose_file, yaml.safe_dump(definition))
    write(env_file, setup.env_text(config))
    command = [
        "docker",
        "compose",
        "-p",
        project,
        "--env-file",
        str(env_file),
        "-f",
        str(compose_file),
    ]
    public_config = {
        "development": True,
        "coreApi": "/core-api/api/v1",
        "coreHealth": "/core-api",
        "issuer": config["OIDC_ISSUER"],
        "clientId": "xarionix-console",
        "mfaAcr": "urn:xarionix:mfa",
        "maxPackageBytes": 134217728,
    }
    public_file = folder / "console-config.json"
    write(public_file, json.dumps(public_config))
    preview = None
    browser = None
    agent = None
    host_id = str(uuid.uuid4())
    hello_image = "xarionix-console-hello-test:" + project
    try:
        print(
            "Validating and starting isolated PostgreSQL, migrations, Keycloak and Core",
            flush=True,
        )
        run(command + ["config", "-q"])
        run(
            command + ["up", "-d", "--build", "--wait", "--wait-timeout", "420"],
            timeout=1500,
        )
        wait_for(config["PUBLIC_URL"] + "/health/ready")
        wait_for(config["OIDC_ISSUER"] + "/.well-known/openid-configuration")
        with psycopg.connect(
            host="localhost",
            port=pg_port,
            dbname="xarionix_core",
            user="core_bootstrap",
            password=config["DB_BOOTSTRAP_PASSWORD"],
        ) as db:
            for name, user in users.items():
                db.execute(
                    "INSERT INTO users(id,display_name) VALUES (%s,%s)",
                    (user["user_id"], name.capitalize() + " Console"),
                )
                db.execute(
                    "INSERT INTO identities(id,issuer,subject,user_id,principal_type) VALUES (%s,%s,%s,%s,'human')",
                    (
                        user["identity_id"],
                        config["OIDC_ISSUER"],
                        user["subject"],
                        user["user_id"],
                    ),
                )
            db.execute(
                sql.SQL("CREATE ROLE {} LOGIN PASSWORD {}").format(
                    sql.Identifier(executor_user), sql.Literal(executor_password)
                )
            )
            source = "\n".join(
                line
                for line in (core / "deploy/postgres/module-executor.sql")
                .read_text()
                .splitlines()
                if not line.startswith("\\")
            )
            for variable, value in (
                ("runtime_role", "core_app"),
                ("installer_role", executor_user),
            ):
                source = source.replace(
                    ':"' + variable + '"', sql.Identifier(value).as_string(db)
                ).replace(":'" + variable + "'", sql.Literal(value).as_string(db))
            db.execute(source, prepare=False)
        run(
            command
            + [
                "exec",
                "-T",
                "core",
                "python",
                "-m",
                "scripts.platform_admin",
                "bootstrap",
                "--identity-id",
                users["admin"]["identity_id"],
            ]
        )
        print(
            "Preparing a signed Hello runtime package (test key stays private)",
            flush=True,
        )
        architecture = (runtime_info or {}).get("Architecture")
        platform = {
            "x86_64": "linux/amd64",
            "amd64": "linux/amd64",
            "aarch64": "linux/arm64",
            "arm64": "linux/arm64",
        }.get(architecture)
        run(
            [
                "docker",
                "build",
                *(["--platform", platform] if platform else []),
                "-t",
                hello_image,
                str(core / "examples/modules/hello-runtime"),
            ]
        )
        archive = folder / "hello-image.tar"
        run(["docker", "image", "save", "-o", str(archive), hello_image])
        package, trust, report, contract = runtime_package(
            folder / "bundle",
            source=archive,
            module="hello-console",
            namespace="hello_console",
            publisher="console-test-publisher",
        )
        with httpx.Client(timeout=15, trust_env=False) as client:
            auth = client.post(
                config["KEYCLOAK_PUBLIC_URL"]
                + "/realms/master/protocol/openid-connect/token",
                data={
                    "grant_type": "password",
                    "client_id": "admin-cli",
                    "username": "bootstrap-admin",
                    "password": config["KC_ADMIN_PASSWORD"],
                },
            )
            auth.raise_for_status()
            headers = {"Authorization": "Bearer " + auth.json()["access_token"]}
            clients = client.get(
                config["KEYCLOAK_PUBLIC_URL"] + "/admin/realms/xarionix/clients",
                headers=headers,
                params={"clientId": "console-deployment"},
            )
            clients.raise_for_status()
            identity = client.get(
                config["KEYCLOAK_PUBLIC_URL"]
                + "/admin/realms/xarionix/clients/"
                + clients.json()[0]["id"]
                + "/service-account-user",
                headers=headers,
            )
            identity.raise_for_status()
            subject = identity.json()["id"]
        deployment = {
            "id": host_id,
            "name": "Console isolated test host",
            "issuer": config["OIDC_ISSUER"],
            "subject": subject,
            "client_id": "console-deployment",
            "engine_id": (runtime_info or {}).get(
                "ID", run(["docker", "info", "--format", "{{.ID}}"]).decode().strip()
            ),
            "platform": contract["platform"],
        }
        state = {
            "baseUrl": config["BROWSER_ORIGIN"],
            "coreUrl": config["PUBLIC_URL"],
            "issuer": config["OIDC_ISSUER"],
            "users": users,
            "package": str(package),
            "packageSha": report["package_sha256"],
            "publicKey": trust.keys[0].public_key,
            "publisher": "console-test-publisher",
            "namespace": "hello_console",
            "operatorDirectory": str(folder / "operator"),
            "platform": contract["platform"],
            "deployment": deployment,
            "nativeRuntime": bool(runtime_info),
        }
        (folder / "operator").mkdir()
        state_file = folder / "state.json"
        write(state_file, json.dumps(state))
        preview = subprocess.Popen(
            [
                "node",
                "scripts/console-preview.mjs",
                "--root",
                "dist/xarionix-console/browser",
                "--config",
                str(public_file),
                "--core",
                config["PUBLIC_URL"],
                "--port",
                str(web_port),
            ],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        wait_for(config["BROWSER_ORIGIN"] + "/console-config.json", timeout=30)
        if args.keep:
            print(
                "Isolated preview ready. Private state file: " + str(state_file),
                flush=True,
            )
        else:
            environment = os.environ | {"CONSOLE_E2E_STATE": str(state_file)}
            browser = subprocess.Popen(
                [
                    "npx",
                    "playwright",
                    "test",
                    "--config",
                    "projects/xarionix-console/e2e/playwright.config.ts",
                    *(["--grep", "smoke"] if args.smoke else []),
                ],
                cwd=ROOT,
                env=environment,
            )
        seen = set()
        while args.keep or browser.poll() is None:
            for message in (folder / "operator").glob("*.request.json"):
                if message.name in seen:
                    continue
                seen.add(message.name)
                value = json.loads(message.read_text())
                if value.get("operation") == "start-agent":
                    if not runtime_info or agent is not None:
                        raise RuntimeError(
                            "Native test agent unavailable or already started"
                        )
                    environment = os.environ | {
                        "PYTHONPATH": str(core),
                        "XARIONIX_DEPLOYMENT_CORE_URL": config["PUBLIC_URL"],
                        "XARIONIX_DEPLOYMENT_ISSUER": config["OIDC_ISSUER"],
                        "XARIONIX_DEPLOYMENT_CLIENT_ID": "console-deployment",
                        "XARIONIX_DEPLOYMENT_CLIENT_SECRET": deployment_secret,
                        "XARIONIX_DEPLOYMENT_HOST_ID": host_id,
                        "XARIONIX_DEPLOYMENT_ENGINE_SOCKET": str(args.runtime_socket),
                        "XARIONIX_DEPLOYMENT_ENGINE_ID": runtime_info["ID"],
                        "XARIONIX_DEPLOYMENT_STORAGE_ROOT": str(
                            (folder / "agent").resolve()
                        ),
                        "XARIONIX_DEPLOYMENT_ISOLATED_HTTP": "true",
                    }
                    agent = subprocess.Popen(
                        [sys.executable, "-m", "scripts.deployment_agent"],
                        cwd=core,
                        env=environment,
                        stdout=subprocess.DEVNULL,
                        stderr=subprocess.DEVNULL,
                    )
                    write(message.with_suffix(".done"), "started")
                    continue
                plan_id = str(uuid.UUID(value["plan_id"]))
                digest = value["digest"]
                if not re.fullmatch("[0-9a-f]{64}", digest):
                    raise RuntimeError("Invalid test operator digest")
                run(
                    command
                    + [
                        "run",
                        "--rm",
                        "--no-deps",
                        "trusted-executor",
                        "python",
                        "-m",
                        "scripts.module_manager",
                        "apply",
                        "--plan-id",
                        plan_id,
                        "--digest",
                        digest,
                    ]
                )
                write(message.with_suffix(".done"), "applied")
            time.sleep(0.1)
        if browser.returncode:
            raise RuntimeError(
                "Console browser integration tests failed; inspect the sanitized JUnit report"
            )
        print("Real Console browser integration passed", flush=True)
    finally:
        cleanup_failed = False
        if agent:
            agent.terminate()
            try:
                agent.wait(timeout=15)
            except subprocess.TimeoutExpired:
                agent.kill()
                agent.wait(timeout=5)
        if runtime_info:
            # Only this run's attested host label; never enumerate/delete arbitrary engine objects.
            try:
                with httpx.Client(
                    transport=httpx.HTTPTransport(uds=str(args.runtime_socket)),
                    base_url="http://engine",
                    trust_env=False,
                    timeout=30,
                ) as client:
                    reply = client.get(
                        "/containers/json",
                        params={
                            "all": "true",
                            "filters": json.dumps(
                                {"label": ["io.xarionix.deployment.host=" + host_id]}
                            ),
                        },
                    )
                    reply.raise_for_status()
                    for row in reply.json():
                        client.delete(
                            "/containers/" + row["Id"], params={"force": "true"}
                        ).raise_for_status()
            except (httpx.HTTPError, OSError, ValueError):
                cleanup_failed = True
        if browser and browser.poll() is None:
            browser.terminate()
            browser.wait(timeout=10)
        if preview:
            preview.terminate()
            preview.wait(timeout=10)
        # This command contains the generated project name and private Compose file only.
        subprocess.run(
            command + ["down", "--volumes", "--remove-orphans"],
            capture_output=True,
            timeout=120,
            check=False,
        )
        subprocess.run(
            ["docker", "image", "rm", hello_image, image],
            capture_output=True,
            timeout=30,
            check=False,
        )
        shutil.rmtree(folder)
        if cleanup_failed:
            raise RuntimeError(
                "Native runtime cleanup was not confirmed; inspect the explicitly selected test daemon"
            )


if __name__ == "__main__":

    def interrupt(_signum, _frame):
        raise KeyboardInterrupt

    signal.signal(signal.SIGTERM, interrupt)
    try:
        main()
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except Exception as error:  # noqa: BLE001 -- Last boundary must redact all fixture credentials.
        print(
            str(error)
            if isinstance(error, RuntimeError)
            else "Console integration setup failed (no credential output)",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
