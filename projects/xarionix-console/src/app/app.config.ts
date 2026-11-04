import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, RouteReuseStrategy } from '@angular/router';
import { ConsoleRouteReuse } from './core/route-reuse';
import { provideSpartanHlm } from '@spartan-ng/helm/utils';
import { Config } from './core/config';
import { Auth } from './core/auth';
import { coreInterceptor } from './core/api';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: ConsoleRouteReuse },
    provideSpartanHlm(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([coreInterceptor])),
    provideAppInitializer(() => {
      const config = inject(Config),
        auth = inject(Auth);
      return config.load().then(() => auth.initialize());
    }),
  ],
};
