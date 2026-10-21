# XarionixWeb

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

The development proxy sends `/api/**` to FastAPI on `127.0.0.1:3000` and
`/map/**` to the dedicated tile proxy on `127.0.0.1:8088`. Start and configure
the backend infrastructure before opening the map on `/addresses`.

## Address map deployment

MapLibre and its copied stylesheet are loaded only after the user opens the map.
The Angular bundle contains neither the Yandex Tiles API key nor the tile-signing
secret. In production, route paths without changing their public origin:

```text
/api/v1/*     -> FastAPI
/map/tiles/*  -> xarionix_map_proxy:8080
```

Do not expose the proxy's internal origin listener or rewrite the relative tile
URL to a Docker hostname in frontend configuration. The Yandex logo stored in
`public/yandex-logo-ru.svg` is the unmodified Russian asset from the official
Tiles API logo pack.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## GitLab CI

The `.gitlab-ci.yml` pipeline installs the locked dependencies with `npm ci`,
runs the unit tests once in CI mode, and creates a production build. The
generated `dist/` directory is published as a pipeline artifact for one week.

The pipeline requires a GitLab Runner with a Docker or Kubernetes executor and
access to the `node:22-alpine` image.

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
