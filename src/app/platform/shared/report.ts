import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UI, label } from './ui';

const titles: Record<string, string> = {
  added: 'Добавлены',
  removed: 'Удалены',
  modified: 'Изменены',
  unchanged: 'Без изменений',
  before: 'До изменения',
  after: 'После изменения',
  ready: 'Готовность',
  blockers: 'Блокирующие условия',
  warnings: 'Предупреждения',
  permissions: 'Права',
  dependencies: 'Зависимости',
  namespace: 'Пространство прав',
  namespaces: 'Пространства прав',
  changed_sections: 'Изменённые разделы',
  protocol: 'Протокол',
  runtime_type: 'Тип модуля',
  core_compatibility: 'Совместимость Core',
  artifacts: 'Артефакты',
  items: 'Записи',
  module_id: 'Модуль',
  publisher_id: 'Издатель',
  state: 'Состояние',
  candidates: 'Доступные версии',
  range: 'Диапазон версий',
  required_by: 'Требуется для',
  cycle_or_complexity_limit: 'Цикл или предел сложности',
  automatic_selection: 'Автоматический выбор',
  memory: 'Память · байт',
  cpu_quota: 'CPU quota',
  pids: 'Лимит процессов',
  tmpfs: 'Временная память · байт',
  mode: 'Режим',
  health: 'Здоровье',
  last_seen: 'Последняя связь',
  binding_active: 'Привязка активна',
  binding_revision: 'Версия привязки',
  instance_id: 'Экземпляр',
  reason: 'Причина',
  live: 'Live',
  ready_at: 'Готов с',
  connected: 'Подключён',
  trusted: 'Доверие',
  generation: 'Поколение',
  status: 'Статус',
};
interface ReportNode {
  title: string;
  text?: string;
  children?: ReportNode[];
}
export function reportNodes(value: unknown, depth = 0): ReportNode[] {
  if (depth > 5) return [{ title: 'Подробности', text: 'Достигнута глубина отображения' }];
  const entries = Array.isArray(value)
    ? value.slice(0, 100).map((v, i) => [String(i + 1), v] as const)
    : value && typeof value === 'object'
      ? Object.entries(value).slice(0, 100)
      : [['Значение', value] as const];
  return entries.map(([key, item]) => ({
    title: titles[key] ?? key,
    ...(item && typeof item === 'object'
      ? { children: reportNodes(item, depth + 1) }
      : { text: label(item).slice(0, 2000) }),
  }));
}
@Component({
  selector: 'console-report',
  imports: [UI, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ng-container *ngTemplateOutlet="tree; context: { $implicit: nodes() }" />
    <ng-template #tree let-items
      ><dl class="space-y-3 text-sm">
        @for (node of items; track $index) {
          <div>
            <dt class="text-xs text-muted-foreground">{{ node.title }}</dt>
            @if (node.children) {
              <dd class="mt-2 border-l pl-3">
                <ng-container *ngTemplateOutlet="tree; context: { $implicit: node.children }" />
              </dd>
            } @else {
              <dd class="mt-1 break-all">{{ node.text }}</dd>
            }
          </div>
        }
      </dl></ng-template
    >
  `,
})
export class Report {
  readonly value = input<unknown>();
  readonly nodes = computed(() => reportNodes(this.value()));
}
