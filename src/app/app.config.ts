import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { switchMap } from 'rxjs';
import { provideSpartanHlm, } from '@spartan-ng/helm/utils';

import { routes } from './app.routes';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { authInterceptor } from './core/auth/auth-interceptor';
import { AuthService } from './core/auth/auth.service';

import { companyInterceptor } from './core/company/company-interceptor';
import { CompanyContextService } from './core/company/company-context.service';

import {
  PermissionService,
} from './core/permissions/permission.service';


export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),

    provideSpartanHlm(),

    provideBrowserGlobalErrorListeners(),

    provideHttpClient(
      withInterceptors([
        authInterceptor,
        companyInterceptor,
      ]),
    ),

    provideAppInitializer(() => {
      const auth =
        inject(AuthService);

      const companyContext =
        inject(CompanyContextService);

      const permissions =
        inject(PermissionService);

      return auth.initialize().pipe(
        switchMap(() =>
          companyContext.initialize(),
        ),

        switchMap(() =>
          permissions.initialize(),
        ),
      );
    }),
  ],
};
