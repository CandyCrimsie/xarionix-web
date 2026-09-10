import { Component } from '@angular/core';

import {
  RouterLink,
} from '@angular/router';

import {
  HlmButtonImports,
} from '@spartan-ng/helm/button';


@Component({
  selector: 'app-forbidden',
  imports: [
    RouterLink,
    HlmButtonImports
  ],
  templateUrl: './forbidden.html',
  styleUrl: './forbidden.css',
})
export class Forbidden { }
