import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteTable } from './invite-table';

describe('InviteTable', () => {
  let component: InviteTable;
  let fixture: ComponentFixture<InviteTable>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InviteTable],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteTable);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
