import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-app-layout',
  imports: [
    RouterOutlet,
    RouterLink,
  ],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
})
export class AppLayout {
  readonly auth = inject(AuthService);

  private readonly router = inject(Router);


  logout(): void {
    this.auth.logout().pipe(
      finalize(() => {
        void this.router.navigateByUrl('/login');
      }),
    ).subscribe();
  }
}
