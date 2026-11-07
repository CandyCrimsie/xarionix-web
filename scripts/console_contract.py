"""Export the real Core OpenAPI without starting services or reading a deployment .env."""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--core", type=Path, default=ROOT.parent / "xarionix-core")
parser.add_argument("--check", action="store_true")
args = parser.parse_args()
core = args.core.resolve()
sys.path.insert(0, str(core))
from app.core.config import Settings
from app.domains.packages.schema import Manifest
from app.main import create_app

settings = Settings(
    keycloak_mode="external",
    public_url="https://console.example.test",
    oidc_issuer="https://id.example.test/realms/xarionix",
    db_password="disposable-contract-export-only-not-a-real-password",
)
schema = create_app(settings).openapi()
# This endpoint's implementation returns dict, so include the actual strict Manifest schema explicitly.
schema["x-xarionix-manifest"] = Manifest.model_json_schema()
# API equality and source pinning are separate checks. Including HEAD here made
# a reviewed, unchanged API fail solely because Core received a new commit.
# CI checkout still requires an explicitly reviewed immutable commit below.
target = ROOT / "projects/xarionix-console/contracts/core-openapi.json"
content = json.dumps(schema, ensure_ascii=False, sort_keys=True, indent=2) + "\n"
if args.check:
    if not target.is_file() or target.read_text() != content:
        raise SystemExit(
            "Core contract drift: review the API and regenerate the audited snapshot"
        )
else:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)
print(f"Core contract: {len(schema['paths'])} paths, snapshot validated")
