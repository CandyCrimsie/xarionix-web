import {
    Component,
    effect,
    computed,
    inject,
    signal,
} from '@angular/core';

import {
    NgIcon,
    provideIcons,
} from '@ng-icons/core';

import {
    lucideLoaderCircle,
    lucideRefreshCw,
} from '@ng-icons/lucide';

import {
    HlmBadgeImports,
} from '@spartan-ng/helm/badge';

import {
    HlmButtonImports,
} from '@spartan-ng/helm/button';

import {
    HlmTableImports,
} from '@spartan-ng/helm/table';

import {
    HlmDialogImports,
} from '@spartan-ng/helm/dialog';

import {
    MemberRoleEditor,
} from './member-role-editor/member-role-editor';

import {
    CompanyContextService,
} from '../../core/company/company-context.service';

import {
    MemberApiService,
} from '../../core/members/member-api.service';

import type {
    CompanyMemberSummary,
} from '../../core/members/member.models';

import {
    OrganizationalUnitType,
} from '../../core/organizational-units/organizational-unit.models';

import {
    PermissionCode,
} from '../../core/permissions/permission.models';

import {
    PermissionService,
} from '../../core/permissions/permission.service';


type MembersState =
    | 'idle'
    | 'loading'
    | 'ready'
    | 'error';


@Component({
    selector: 'app-members',

    imports: [
        NgIcon,
        HlmBadgeImports,
        HlmButtonImports,
        HlmTableImports,
        HlmDialogImports,
        MemberRoleEditor,
    ],

    providers: [
        provideIcons({
            lucideLoaderCircle,
            lucideRefreshCw,
        }),
    ],

    templateUrl:
        './members.html',

    styleUrl:
        './members.css',
})
export class Members {
    private readonly memberApi =
        inject(MemberApiService);

    private readonly companyContext =
        inject(CompanyContextService);

    private readonly permissions =
        inject(PermissionService);


    private readonly _members =
        signal<
            CompanyMemberSummary[]
        >([]);

    private readonly _state =
        signal<MembersState>(
            'idle',
        );

    private readonly _reloadVersion =
        signal(0);


    readonly members =
        this._members.asReadonly();

    readonly state =
        this._state.asReadonly();


    readonly canAssignRoles =
        computed(
            () =>
                this.permissions.can(
                    PermissionCode.RolesAssign,
                ),
        );


    constructor() {
        effect(
            onCleanup => {
                this._reloadVersion();


                const companyId =
                    this.companyContext
                        .activeCompanyId();

                const canReadMembers =
                    this.permissions.can(
                        PermissionCode
                            .MembersRead,
                    );


                /*
                 * Во время company switch
                 * PermissionService становится
                 * fail-closed.
                 *
                 * Поэтому данные предыдущей
                 * компании сразу исчезают.
                 */
                if (
                    companyId === null
                    || !canReadMembers
                ) {
                    this.reset();

                    return;
                }


                this._members.set([]);

                this._state.set(
                    'loading',
                );


                const subscription =
                    this.memberApi
                        .list(
                            companyId,
                        )
                        .subscribe({
                            next: members => {
                                this._members.set(
                                    members,
                                );

                                this._state.set(
                                    'ready',
                                );
                            },

                            error: () => {
                                this._members.set([]);

                                this._state.set(
                                    'error',
                                );
                            },
                        });


                /*
                 * Если компания поменяется
                 * во время HTTP-запроса,
                 * старый запрос отменяется.
                 */
                onCleanup(
                    () => {
                        subscription
                            .unsubscribe();
                    },
                );
            },
        );
    }


    retry(): void {
        this._reloadVersion.update(
            version =>
                version + 1,
        );
    }


    unitTypeLabel(
        type:
            OrganizationalUnitType,
    ): string {
        switch (type) {
            case OrganizationalUnitType.Division:
                return 'Дивизион';

            case OrganizationalUnitType.Department:
                return 'Отдел';

            case OrganizationalUnitType.Team:
                return 'Команда';

            case OrganizationalUnitType.Group:
                return 'Группа';

            case OrganizationalUnitType.Branch:
                return 'Филиал';
        }
    }


    private reset(): void {
        this._members.set([]);

        this._state.set(
            'idle',
        );
    }
}