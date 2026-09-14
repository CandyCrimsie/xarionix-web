import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';

import {
  provideRouter,
} from '@angular/router';

import {
  of,
  switchMap,
} from 'rxjs';

import {
  provideSpartanHlm,
} from '@spartan-ng/helm/utils';

import {
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';

import {
  routes,
} from './app.routes';

import {
  authInterceptor,
} from './core/auth/auth-interceptor';

import {
  AuthService,
} from './core/auth/auth.service';

import {
  companyInterceptor,
} from './core/company/company-interceptor';

import {
  CompanyContextService,
} from './core/company/company-context.service';

import {
  PermissionService,
} from './core/permissions/permission.service';

import {
  PermissionRouteRevalidationService,
} from './core/permissions/permission-route-revalidation.service';

import {
  SetupStateService,
} from './core/setup/setup-state.service';


export const appConfig:
  ApplicationConfig = {
  providers: [
    provideRouter(
      routes,
    ),

    provideSpartanHlm(),

    provideBrowserGlobalErrorListeners(),

    provideHttpClient(
      withInterceptors([
        authInterceptor,
        companyInterceptor,
      ]),
    ),

    provideAppInitializer(
      () => {
        const setupState =
          inject(
            SetupStateService,
          );

        const auth =
          inject(
            AuthService,
          );

        const companyContext =
          inject(
            CompanyContextService,
          );

        const permissions =
          inject(
            PermissionService,
          );

        const permissionRouteRevalidation =
          inject(
            PermissionRouteRevalidationService,
          );


        /*
         * Можно запускать сразу:
         * сервис просто слушает события
         * PermissionService.
         *
         * Это также пригодится после
         * завершения setup без полного
         * reload страницы.
         */
        permissionRouteRevalidation
          .start();


        /*
         * Installation state всегда
         * определяется первым.
         */
        return setupState
          .initialize()
          .pipe(
            switchMap(
              () => {
                /*
                 * READY:
                 * setup ещё не выполнен.
                 *
                 * INCONSISTENT:
                 * установка повреждена.
                 *
                 * ERROR:
                 * status определить не удалось.
                 *
                 * Во всех этих случаях
                 * auth/company/permissions
                 * НЕ запускаем.
                 */
                if (
                  !setupState
                    .isInstalled()
                ) {
                  return of(
                    undefined,
                  );
                }


                /*
                 * Только установленная ERP
                 * запускает обычный bootstrap.
                 */
                return auth
                  .initialize()
                  .pipe(
                    switchMap(
                      () =>
                        companyContext
                          .initialize(),
                    ),

                    switchMap(
                      () =>
                        permissions
                          .initialize(),
                    ),
                  );
              },
            ),
          );
      },
    ),
  ],
};