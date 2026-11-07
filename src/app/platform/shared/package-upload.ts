import { HttpEventType } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  output,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { CoreApi } from '../core/api';
import { Config } from '../core/config';
import { RequestScope } from '../core/scope';
import { CoreError, coreError } from '../core/errors';
import { Package } from '../core/models';
import { UI, ICONS } from './ui';
import { ErrorBox } from './feedback';
import { toast } from '@spartan-ng/brain/sonner';
export function packageFileError(file: Pick<File, 'name' | 'size'>, limit: number): string | null {
  return !file.name.toLowerCase().endsWith('.xpkg')
    ? 'Выберите файл .xpkg.'
    : file.size <= 0
      ? 'Файл пуст.'
      : file.size > limit
        ? 'Пакет превышает установленный лимит.'
        : null;
}
@Component({
  selector: 'console-package-upload',
  imports: [UI, ErrorBox],
  providers: [ICONS],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" (dragover)="$event.preventDefault()" (drop)="drop($event)">
      <div class="flex items-start gap-4">
        <span class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"
          ><ng-icon name="lucideUpload"
        /></span>
        <div class="min-w-0 flex-1">
          <h2>Импорт пакета</h2>
          <p class="mt-1 text-sm text-muted-foreground">
            Перетащите .xpkg или выберите файл. До {{ limitMiB }} МиБ. Подпись, содержимое и доверие
            проверяет Core.
          </p>
        </div>
      </div>
      <input
        hlmInput
        class="mt-5"
        type="file"
        accept=".xpkg"
        aria-label="Файл пакета .xpkg"
        [disabled]="busy()"
        (change)="choose($event)"
      />
      @if (validation()) {
        <p role="alert" class="mt-3 text-sm text-destructive">{{ validation() }}</p>
      }
      @if (file(); as f) {
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <span class="truncate"
            >{{ f.name }}
            <span class="text-muted-foreground"
              >· {{ (f.size / 1048576).toFixed(2) }} МиБ</span
            ></span
          >
          <div class="flex gap-2">
            @if (busy()) {
              <button hlmBtn variant="outline" size="sm" (click)="cancel()">
                Отменить загрузку
              </button>
            } @else {
              <button hlmBtn size="sm" (click)="upload()">Загрузить пакет</button>
            }
          </div>
        </div>
      }
      @if (busy()) {
        <div class="mt-4 text-xs text-muted-foreground" role="status">
          {{ progress() === 100 ? 'Проверка подписи и архива…' : 'Загрузка: ' + progress() + '%' }}
        </div>
        <div
          role="progressbar"
          aria-label="Загрузка пакета"
          [attr.aria-valuenow]="progress()"
          aria-valuemin="0"
          aria-valuemax="100"
          class="mt-2 h-1 overflow-hidden rounded-full bg-muted"
        >
          <div class="h-full bg-primary transition-[width]" [style.width.%]="progress()"></div>
        </div>
      }
      @if (cancelled()) {
        <p class="mt-3 text-xs text-muted-foreground">
          Загрузка отменена на клиенте. Обновите реестр: сервер мог завершить импорт до отмены.
        </p>
      }
      <div class="mt-3"><console-error [error]="error()" /></div>
    </section>
  `,
})
export class PackageUpload {
  private readonly api = inject(CoreApi);
  private readonly config = inject(Config);
  private readonly scope = inject(RequestScope);
  readonly imported = output<Package>();
  readonly file = signal<File | null>(null);
  readonly validation = signal<string | null>(null);
  readonly busy = signal(false);
  readonly progress = signal(0);
  readonly cancelled = signal(false);
  readonly error = signal<CoreError | null>(null);
  private subscription?: Subscription;
  readonly limitMiB = Math.floor(this.config.value.maxPackageBytes / 1048576);
  constructor() {
    const sub = this.scope.changed.subscribe(() => {
      this.cancel();
      this.file.set(null);
      this.error.set(null);
    });
    inject(DestroyRef).onDestroy(() => {
      sub.unsubscribe();
      this.subscription?.unsubscribe();
    });
  }
  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.select(file);
  }
  drop(event: DragEvent): void {
    event.preventDefault();
    if (this.busy()) return;
    const file = event.dataTransfer?.files[0];
    if (file) this.select(file);
  }
  select(file: File): void {
    this.validation.set(packageFileError(file, this.config.value.maxPackageBytes));
    this.file.set(this.validation() ? null : file);
    this.error.set(null);
    this.cancelled.set(false);
  }
  upload(): void {
    const file = this.file();
    if (!file || this.busy() || packageFileError(file, this.config.value.maxPackageBytes)) return;
    this.busy.set(true);
    this.progress.set(0);
    this.error.set(null);
    this.cancelled.set(false);
    this.subscription = this.api.upload(file).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress)
          this.progress.set(
            Math.min(100, Math.round((event.loaded / (event.total ?? file.size)) * 100)),
          );
        if (event.type === HttpEventType.Response && event.body) {
          this.busy.set(false);
          this.file.set(null);
          this.imported.emit(event.body);
          toast.success('Пакет импортирован в реестр');
        }
      },
      error: (e) => {
        this.error.set(coreError(e));
        this.busy.set(false);
      },
      complete: () => this.busy.set(false),
    });
  }
  cancel(): void {
    if (this.busy()) {
      this.subscription?.unsubscribe();
      this.busy.set(false);
      this.cancelled.set(true);
    }
  }
}
