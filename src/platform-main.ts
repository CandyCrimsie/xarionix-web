import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/platform/app.config';
import { App } from './app/platform/app';

try {
  document.documentElement.classList.toggle(
    'dark',
    localStorage.getItem('xarionix.console.theme') !== 'light',
  );
} catch {
  document.documentElement.classList.add('dark');
}
bootstrapApplication(App, appConfig).catch(() => {
  document.body.textContent =
    'Не удалось запустить Xarionix. Проверьте публичную конфигурацию и доступность сервисов.';
});
