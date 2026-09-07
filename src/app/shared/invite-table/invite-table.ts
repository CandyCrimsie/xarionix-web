import { Component, signal } from '@angular/core';

import {
  columnFilteringFeature,
  type ColumnFiltersState,

  columnVisibilityFeature,
  type ColumnVisibilityState,

  createColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,

  filterFn_includesString,

  FlexRender,
  injectTable,
  isFunction,

  rowPaginationFeature,

  tableFeatures,
} from '@tanstack/angular-table';

import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronDown,
  lucideArrowLeft,
  lucideArrowRight,
  lucideCheck,
  lucideX,
  lucideLoaderCircle,
  lucideCopy
} from '@ng-icons/lucide';


export type Invite = {
  id: number;
  code: string;
  created: string;
  expired: string;
  status: 'pending' | 'success' | 'expired';
  owner: string;
  host: string;
  device: string;
};


const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowPaginationFeature,

  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),

  filterFns: {
    includesString: filterFn_includesString,
  },
});

export type DataTableFeatures = typeof features;


const columnHelper = createColumnHelper<DataTableFeatures, Invite>();


const columns = columnHelper.columns([

  // Код
  columnHelper.accessor('code', {
    id: 'code',
    header: 'Код',
    cell: (info) => info.getValue<string>(),
  }),

  // Создан
  columnHelper.accessor('created', {
    id: 'created',
    header: 'Создан',
    cell: (info) => info.getValue<string>(),
  }),

  // Истекает
  columnHelper.accessor('expired', {
    id: 'expired',
    header: 'Истекает',
    cell: (info) => info.getValue<string>(),
  }),

  // Статус
  columnHelper.accessor('status', {
    id: 'status',
    header: 'Статус',
    cell: (info) => info.getValue<string>(),
  }),

  // Владелец
  columnHelper.accessor('owner', {
    id: 'owner',
    header: 'Создал',
    cell: (info) => info.getValue<string>(),
  }),

  // IP
  columnHelper.accessor('host', {
    id: 'host',
    header: 'Хост',
    cell: (info) => info.getValue<string>(),
  }),

  // Устройство
  columnHelper.accessor('device', {
    id: 'device',
    header: 'Устройство',
    cell: (info) => info.getValue<string>(),
  }),
]);


@Component({
  selector: 'app-invite-table',

  imports: [
    FlexRender,

    NgIcon,

    HlmInputImports,
    HlmButtonImports,
    HlmTableImports,
    HlmDropdownMenuImports,
    HlmBadgeImports,
  ],

  providers: [
    provideIcons({
      lucideChevronDown,
      lucideArrowLeft,
      lucideArrowRight,
      lucideCheck,
      lucideX,
      lucideLoaderCircle,
      lucideCopy
    }),
  ],
  standalone: true,
  templateUrl: './invite-table.html',
  styleUrl: './invite-table.css',
})
export class InviteTable {

  protected readonly _columns = columns;

  protected readonly _copiedCode = signal<string | null>(null);

  protected readonly _invites = signal<Invite[]>([
    {
      id: 1,
      code: '11e799c9-150f-48e7-ba23-5c34f0f36801',
      created: '2026-01-01 00:00:00',
      expired: '2026-01-01 00:05:00',
      status: 'success',
      owner: 'Реутский Д.А.',
      host: '10.110.5.177',
      device: 'Linux Debian 13',
    },
    {
      id: 2,
      code: 'd08f7c6c-9e0f-4ae9-bca9-7c5728bab9e0',
      created: '2026-01-01 00:00:00',
      expired: '2026-01-01 00:05:00',
      status: 'expired',
      owner: 'Попов М.С.',
      host: '10.110.5.21',
      device: 'Windows 11',
    },
    {
      id: 3,
      code: '20fe09c3-56e3-4b78-8296-88bf88f1146d',
      created: '2026-01-01 00:00:00',
      expired: '2026-01-01 00:05:00',
      status: 'pending',
      owner: 'Смирнов А.В.',
      host: '10.110.5.61',
      device: 'Windows 10',
    },
  ]);


  private readonly _columnFilters =
    signal<ColumnFiltersState>([]);

  private readonly _columnVisibility =
    signal<ColumnVisibilityState>({});


  protected readonly _table = injectTable(() => ({
    features,

    columns,

    data: this._invites(),

    onColumnFiltersChange: (updater) => {
      updater instanceof Function
        ? this._columnFilters.update(updater)
        : this._columnFilters.set(updater);
    },

    onColumnVisibilityChange: (updater) => {
      updater instanceof Function
        ? this._columnVisibility.update(updater)
        : this._columnVisibility.set(updater);
    },

    state: {
      columnFilters: this._columnFilters(),
      columnVisibility: this._columnVisibility(),
    },
  }));


  protected readonly _hidableColumns =
    this._table
      .getAllColumns()
      .filter(column => column.getCanHide());

  protected _getStatusVariant(
    status: Invite['status']
  ): 'default' | 'secondary' | 'destructive' | 'outline' {

    switch (status) {
      case 'success':
        return 'default';

      case 'pending':
        return 'secondary';

      case 'expired':
        return 'destructive';
    }
  }


  protected _getStatusLabel(status: Invite['status']): string {
    switch (status) {
      case 'success':
        return 'Success';

      case 'pending':
        return 'Pending';

      case 'expired':
        return 'Expired';
    }
  }

  protected async _copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);

      this._copiedCode.set(code);

      setTimeout(() => {
        if (this._copiedCode() === code) {
          this._copiedCode.set(null);
        }
      }, 1500);
    } catch (error) {
      console.error('Не удалось скопировать код:', error);
    }
  }
}