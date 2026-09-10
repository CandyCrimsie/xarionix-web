import {
    DestroyRef,
    inject,
    Injectable,
} from '@angular/core';

import {
    Router,
} from '@angular/router';

import {
    catchError,
    from,
    of,
    switchMap,
} from 'rxjs';

import {
    takeUntilDestroyed,
} from '@angular/core/rxjs-interop';

import {
    PermissionService,
} from './permission.service';


@Injectable({
    providedIn: 'root',
})
export class PermissionRouteRevalidationService {
    private readonly router =
        inject(Router);

    private readonly permissions =
        inject(PermissionService);

    private readonly destroyRef =
        inject(DestroyRef);

    private started = false;


    start(): void {
        if (this.started) {
            return;
        }

        this.started = true;

        this.permissions
            .companyPermissionsSettled$
            .pipe(
                switchMap(() => {
                    const currentUrl =
                        this.router.url;

                    return from(
                        this.router.navigateByUrl(
                            currentUrl,
                            {
                                onSameUrlNavigation:
                                    'reload',

                                replaceUrl: true,
                            },
                        ),
                    ).pipe(
                        catchError(() =>
                            of(false),
                        ),
                    );
                }),

                takeUntilDestroyed(
                    this.destroyRef,
                ),
            )
            .subscribe();
    }
}