import { TestBed } from '@angular/core/testing';

import { CompanyContextService } from './company-context.service';

describe('CompanyContextService', () => {
  let service: CompanyContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanyContextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
