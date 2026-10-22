import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProfileApiService } from './profile-api.service';
import { companyInterceptor } from '../company/company-interceptor';
import { CompanyContextService } from '../company/company-context.service';

describe('ProfileApiService', () => {
    it('loads the authenticated company-scoped profile, not a public user ID endpoint', () => {
        TestBed.configureTestingModule({ providers: [
            provideHttpClient(withInterceptors([companyInterceptor])), provideHttpClientTesting(),
            { provide: CompanyContextService, useValue: { activeCompanyId: () => 7 } },
        ] });
        const http = TestBed.inject(HttpTestingController);
        TestBed.inject(ProfileApiService).getMyProfile().subscribe();
        const request = http.expectOne('/api/v1/me/profile');
        expect(request.request.method).toBe('GET');
        expect(request.request.headers.get('X-Company-Id')).toBe('7');
        request.flush({});
        http.verify();
    });
});
