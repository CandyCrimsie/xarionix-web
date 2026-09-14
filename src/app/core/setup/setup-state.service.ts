import {
    computed,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import {
    catchError,
    map,
    Observable,
    of,
    tap,
} from 'rxjs';

import {
    SetupApiService,
} from './setup-api.service';

import {
    InstallationState,
} from './setup.models';

import type {
    SetupStatusResponse,
} from './setup.models';


type SetupState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


@Injectable({
    providedIn:
        'root',
})
export class SetupStateService {
    private readonly api =
        inject(
            SetupApiService,
        );


    private readonly _state =
        signal<SetupState>(
            'idle',
        );

    private readonly _status =
        signal<
            SetupStatusResponse | null
        >(
            null,
        );


    readonly state =
        this._state.asReadonly();

    readonly status =
        this._status.asReadonly();


    readonly installationState =
        computed(
            () =>
                this._status()
                    ?.state
                ?? null,
        );


    readonly setupAllowed =
        computed(
            () =>
                this._status()
                    ?.setup_allowed
                ?? false,
        );


    readonly isSetupRequired =
        computed(
            () =>
                this._state()
                === 'ready'
                && this.installationState()
                === InstallationState.Ready
                && this.setupAllowed(),
        );


    readonly isInstalled =
        computed(
            () =>
                this._state()
                === 'ready'
                && this.installationState()
                === InstallationState.Installed,
        );


    readonly isInconsistent =
        computed(
            () =>
                this._state()
                === 'ready'
                && this.installationState()
                === InstallationState.Inconsistent,
        );


    readonly hasError =
        computed(
            () =>
                this._state()
                === 'error',
        );


    initialize():
        Observable<void> {
        return this.load();
    }


    refresh():
        Observable<void> {
        return this.load();
    }


    private load():
        Observable<void> {
        this._state.set(
            'loading',
        );

        /*
         * Во время нового запроса нельзя
         * продолжать доверять предыдущему
         * installation state.
         */
        this._status.set(
            null,
        );


        return this.api
            .status()
            .pipe(
                tap(
                    status => {
                        this._status.set(
                            status,
                        );

                        this._state.set(
                            'ready',
                        );
                    },
                ),

                map(
                    () =>
                        undefined,
                ),

                catchError(
                    () => {
                        /*
                         * Fail closed.
                         *
                         * Если состояние установки
                         * определить нельзя,
                         * обычный application bootstrap
                         * запускать нельзя.
                         */
                        this._status.set(
                            null,
                        );

                        this._state.set(
                            'error',
                        );

                        return of(
                            undefined,
                        );
                    },
                ),
            );
    }
}