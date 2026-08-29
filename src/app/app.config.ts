import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { authInterceptor } from './core/auth/auth-interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideBrowserGlobalErrorListeners(),

    provideHttpClient(
      withInterceptors([
        authInterceptor,
      ]),
    ),

    provideAppInitializer(() => {
      const auth = inject(AuthService);

      return auth.initialize();
    }),
  ],
};
