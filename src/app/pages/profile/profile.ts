import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideLoaderCircle, lucideRefreshCw } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';

import { CompanyContextService } from '../../core/company/company-context.service';
import { ProfileApiService } from '../../core/profile/profile-api.service';
import type { MyProfile } from '../../core/profile/profile.models';
import { employeeDisplayName } from '../../core/profile/profile.models';
import { EmployeeDetails } from '../../shared/employee-details/employee-details';

@Component({
    selector: 'app-profile',
    imports: [DatePipe, NgIcon, HlmButtonImports, HlmCardImports, EmployeeDetails],
    providers: [provideIcons({ lucideLoaderCircle, lucideRefreshCw })],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './profile.html',
})
export class Profile {
    readonly displayName = employeeDisplayName;
    private readonly profileApi = inject(ProfileApiService);
    private readonly companyContext = inject(CompanyContextService);
    private readonly reloadVersion = signal(0);

    readonly profile = signal<MyProfile | null>(null);
    readonly state = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');

    constructor() {
        effect(onCleanup => {
            const companyId = this.companyContext.activeCompanyId();
            this.reloadVersion();
            this.profile.set(null);
            if (companyId === null) {
                this.state.set('idle');
                return;
            }
            this.state.set('loading');
            const subscription = this.profileApi.getMyProfile().subscribe({
                next: profile => {
                    if (profile.company_id !== companyId) {
                        this.state.set('error');
                        return;
                    }
                    this.profile.set(profile);
                    this.state.set('ready');
                },
                error: () => this.state.set('error'),
            });
            onCleanup(() => subscription.unsubscribe());
        });
    }

    retry(): void {
        this.reloadVersion.update(version => version + 1);
    }
}
