import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Session } from '../core/session';
import { UI } from '../shared/ui';

@Component({
  selector: 'app-module-workspace',
  imports: [UI],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <h1>Модули компании</h1>
      @if (!session.company()) {
        <p class="description">Выберите компанию, чтобы работать с её модулями.</p>
        <a hlmBtn variant="outline" class="mt-5" routerLink="/companies">Выбрать компанию</a>
      } @else if (session.can('hello.items.read')) {
        <a hlmBtn variant="outline" class="mt-5" routerLink="/modules/hello-business"
          >Деловые записи</a
        >
        <p class="description mt-3">
          Доступность установленного модуля повторно проверяется сервером при каждом запросе.
        </p>
      } @else {
        <p class="description">Нет доступных разделов с подтверждёнными правами.</p>
      }
    </section>
  `,
})
export class ModuleWorkspacePage {
  readonly session = inject(Session);
}
