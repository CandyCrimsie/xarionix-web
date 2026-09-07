import { Injectable, signal } from '@angular/core';
import { AppAlert } from './alert.model';


@Injectable({
  providedIn: 'root',
})
export class AlertService {
  private readonly _alert = signal<AppAlert | null>(null);

  readonly alert = this._alert.asReadonly();

  private hideTimeout: ReturnType<typeof setTimeout> | null = null;


  show(
    alert: AppAlert,
    duration: number = 5000,
  ): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }

    this._alert.set(alert);

    this.hideTimeout = setTimeout(() => {
      this.hide();
    }, duration);
  }


  hide(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = null;
    }

    this._alert.set(null);
  }
}