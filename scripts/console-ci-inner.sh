#!/bin/sh
set -eu
umask 077
mkdir -p "$TMPDIR"
ln -s /opt/console/node_modules node_modules
python -m pip install --no-deps --editable ../core >/dev/null
npm run console:build
npm run console:bundle-check
python scripts/console_contract.py --core ../core --check
python scripts/console_integration.py --core ../core
