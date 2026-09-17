import {
  ComponentFixture,
  TestBed,
} from '@angular/core/testing';

import {
  provideRouter,
} from '@angular/router';

import {
  Login,
} from './login';


describe('Login', () => {
  let component: Login;
  let fixture:
    ComponentFixture<Login>;


  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        Login,
      ],

      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    fixture =
      TestBed.createComponent(
        Login,
      );

    component =
      fixture.componentInstance;

    await fixture.whenStable();
  });


  it('should create', () => {
    expect(
      component,
    ).toBeTruthy();
  });

  it(
    'should accept regular username without email format',
    () => {
      component.form
        .setValue({
          username:
            'admin',

          password:
            'password123',
        });


      expect(
        component.form.valid,
      ).toBe(true);
    },
  );
});