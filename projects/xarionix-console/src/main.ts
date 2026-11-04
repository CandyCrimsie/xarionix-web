import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

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
    'Не удалось запустить Xarionix Console. Проверьте публичную конфигурацию и доступность сервисов.';
});
