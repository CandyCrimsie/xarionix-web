import {
  signal,
} from '@angular/core';

import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {
  PermissionCode,
} from '../../core/permissions/permission.models';

import {
  PermissionService,
} from '../../core/permissions/permission.service';

import {
  Invite,
} from './invite';


describe(
  'Invite',
  () => {
    let component:
      Invite;

    let fixture:
      ComponentFixture<Invite>;

    const canCreateInvite =
      signal(false);

    const permissions = {
      canSignal:
        vi.fn(
          () =>
            canCreateInvite
              .asReadonly(),
        ),
    };


    beforeEach(async () => {
      vi.clearAllMocks();

      canCreateInvite.set(
        false,
      );

      await TestBed
        .configureTestingModule({
          imports: [
            Invite,
          ],

          providers: [
            {
              provide:
                PermissionService,

              useValue:
                permissions,
            },
          ],
        })
        .compileComponents();

      fixture =
        TestBed.createComponent(
          Invite,
        );

      component =
        fixture.componentInstance;

      fixture.detectChanges();
    });


    it(
      'should create',
      () => {
        expect(
          component,
        ).toBeTruthy();

        expect(
          permissions.canSignal,
        ).toHaveBeenCalledWith(
          PermissionCode.MembersManage,
        );
      },
    );


    it(
      'should hide create invite action without permission',
      () => {
        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="create-invite-action"]',
          ),
        ).toBeNull();

        expect(
          element.querySelector(
            '[data-testid="create-invite-submit"]',
          ),
        ).toBeNull();
      },
    );


    it(
      'should show create invite action with permission',
      () => {
        canCreateInvite.set(
          true,
        );

        fixture.detectChanges();

        const element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="create-invite-action"]',
          ),
        ).not.toBeNull();
      },
    );


    it(
      'should reactively hide create action when permission is lost',
      () => {
        canCreateInvite.set(
          true,
        );

        fixture.detectChanges();

        let element:
          HTMLElement =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="create-invite-action"]',
          ),
        ).not.toBeNull();


        canCreateInvite.set(
          false,
        );

        fixture.detectChanges();

        element =
          fixture.nativeElement;

        expect(
          element.querySelector(
            '[data-testid="create-invite-action"]',
          ),
        ).toBeNull();
      },
    );
  },
);