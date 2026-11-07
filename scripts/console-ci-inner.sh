#!/bin/sh
set -eu
umask 077
mkdir -p "$TMPDIR"
ln -s /opt/console/node_modules node_modules
python -m pip install --no-deps --editable ../core >/dev/null
python -m venv ../erp/.venv
../erp/.venv/bin/python -m pip install -r ../erp/requirements-dev.txt >/dev/null
python scripts/test_console_ci.py
python scripts/validate_web_nginx.py
npm run build
npm run console:build
npm run console:bundle-check
python scripts/console_contract.py --core ../core --check
python scripts/console_integration.py --core ../core --erp ../erp
