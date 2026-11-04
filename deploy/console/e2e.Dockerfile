# Disposable tooling image; never a production image or a runtime-rootless Runner job.
ARG CORE_TOOLBOX
FROM node:22.22.2-bookworm-slim AS node
FROM ${CORE_TOOLBOX}
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /opt/console
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
    && npx playwright install --with-deps --only-shell chromium \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/*
ENV PATH=/opt/console/node_modules/.bin:/opt/ci/venv/bin:$PATH
