'use client';

/**
 * VelzonDataGrid — tabel kerja Area Admin (pola docs/UI_UX_DESIGN.md §9.2).
 *
 * Yang dijaga dari versi lama: nama ekspor `VelzonDataGrid`, tipe `ColumnDef`,
 * dan seluruh prop publik (`title`, `subtitle`, `columns`, `data`,
 * `keyExtractor`, `searchable`, `searchPlaceholder`, `searchKeys`,
 * `pagination`, `defaultPageSize`, `pageSizeOptions`, `actions`,
 * `emptyMessage`, `isLoading`). Semua prop baru bersifat opsional sehingga
 * pemanggil lama (`/academic/khs`, `/academic/advisor`) tetap kompil.
 *
 * Aturan visual (tidak boleh dilanggar di sini):
 *  - Tidak ada hexa / `gray-*` / `bg-white` / `text-black`: hanya kelas token
 *    `.card`, `.card-header`, `.table-head`, `.table-row`, `.badge-soft-<tone>`,
 *    `.btn-soft-<tone>` dan ramp `slate-*` yang sudah tema-sadar
 *    (globals.css bagian design system §2).
 *  - Head = uppercase 11px + `text-slate-500` + latar `slate-50/85` (dari
 *    `.table-head`) + hairline bawah.
 *  - Enam state layar (§9.8) punya wujud: loading (skeleton baris), kosong
 *    (sebab + aksi), error server (kode + pesan + tautan perbaikan),
 *    offline (bar read-only di atas data), plus selection/row-action.
 *  - Status SELALU `StatusBadge` (peta enum → token), bukan warna lokal.
 *  - Dropdown render di luar wadah `overflow-x-auto` supaya tidak terpotong
 *    (karena itu root TIDAK memakai `overflow-hidden`).
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Inbox,
  Search,
  SlidersHorizontal,
  WifiOff,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dropdown, DropdownItem, DropdownLabel } from '@/components/ui/dropdown';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn } from '@/lib/utils';

const ALL_FILTER_VALUE = '__all__';

/** Tipe sel bawaan — `status` wajib lewat `StatusBadge` (enum → token). */
export type GridCellValueType = 'text' | 'status' | 'number';

export interface ColumnDef<T> {
  readonly key: string;
  readonly header: string;
  readonly width?: string;
  readonly sortable?: boolean;
  readonly align?: 'left' | 'center' | 'right';
  /** Default `text`. `status` → StatusBadge, `number` → angka tabular. */
  readonly valueType?: GridCellValueType;
  /** Untuk `valueType: 'status'` — pembaca enum bila kolom computed. */
  readonly statusValue?: (row: T) => string | null | undefined;
  /** Untuk kolom computed (key bukan field baris) — value dipakai sort. */
  readonly sortValue?: (row: T) => string | number | null | undefined;
  readonly render?: (row: T, index: number) => React.ReactNode;
}

export interface DataGridFilterOption {
  readonly value: string;
  readonly label: string;
}

/** Filter satu-kolom bergaya Velzon (dirender dengan primitif `Dropdown`). */
export interface DataGridFilter<T> {
  readonly label: string;
  readonly options: readonly DataGridFilterOption[];
  readonly accessor: (row: T) => string | null | undefined;
  readonly allLabel?: string;
}

export interface DataGridRowAction<T> {
  readonly id: string;
  readonly label: string;
  /** Ikon lucide `size={16} strokeWidth={2}` — bukan teks biru. */
  readonly icon: React.ReactNode;
  readonly onSelect: (row: T) => void;
  readonly isDisabled?: (row: T) => boolean;
  readonly tone?: 'default' | 'danger';
}

export interface DataGridSelection<T> {
  readonly isSelected: (row: T) => boolean;
  readonly onToggle: (row: T) => void;
  /** Dipakai oleh kotak header (pilih banyak). Bila absent: per baris. */
  readonly onSelectMany?: (rows: readonly T[], selected: boolean) => void;
  readonly isDisabled?: (row: T) => boolean;
  readonly label?: string;
}

export interface DataGridEmptyState {
  readonly title?: string;
  readonly description?: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export interface DataGridErrorState {
  /** Kode server, mis. `423 PERIOD_CLOSED` (docs/API_SPEC.md §4.6.5). */
  readonly code?: string;
  readonly message: string;
  readonly retryLabel?: string;
  readonly onRetry?: () => void;
}

export interface VelzonDataGridProps<T> {
  readonly columns: readonly ColumnDef<T>[];
  readonly data: readonly T[];
  readonly keyExtractor: (row: T) => string | number;
  readonly title?: string;
  readonly subtitle?: string;
  readonly eyebrow?: string;
  readonly searchable?: boolean;
  readonly searchPlaceholder?: string;
  readonly searchKeys?: (keyof T)[];
  readonly filter?: DataGridFilter<T>;
  /** Kontrol tambahan di toolbar (di antara filter dan `actions`). */
  readonly toolbar?: React.ReactNode;
  readonly actions?: React.ReactNode;
  readonly emptyMessage?: string;
  readonly emptyState?: DataGridEmptyState;
  readonly error?: DataGridErrorState | null;
  readonly offline?: boolean;
  readonly offlineMessage?: string;
  readonly isLoading?: boolean;
  readonly skeletonRows?: number;
  readonly pagination?: boolean;
  readonly defaultPageSize?: number;
  readonly pageSizeOptions?: readonly number[];
  /** Baris dapat diklik → drawer detail (§9.2: daftar → drawer). */
  readonly onRowOpen?: (row: T) => void;
  readonly rowAriaLabel?: (row: T) => string;
  readonly rowActions?: readonly DataGridRowAction<T>[];
  readonly selection?: DataGridSelection<T>;
  readonly dense?: boolean;
  readonly ariaLabel?: string;
}

const alignClass = (align: 'left' | 'center' | 'right' | undefined): string =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/** Jendela nomor halaman Velzon: 1 … c-1 c c+1 … total. */
function buildPageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push('gap');
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < total - 1) pages.push('gap');
  pages.push(total);
  return pages;
}

function GridCheckbox({
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
  label,
}: {
  readonly checked: boolean;
  readonly indeterminate?: boolean;
  readonly disabled?: boolean;
  readonly onChange: () => void;
  readonly label: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (node) node.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-primary disabled:cursor-not-allowed disabled:opacity-45"
    />
  );
}

export function VelzonDataGrid<T>({
  columns,
  data,
  keyExtractor,
  title,
  subtitle,
  eyebrow,
  searchable = true,
  searchPlaceholder = 'Cari data...',
  searchKeys,
  filter,
  toolbar,
  actions,
  emptyMessage = 'Belum ada data untuk ditampilkan.',
  emptyState,
  error = null,
  offline = false,
  offlineMessage = 'Koneksi terputus — data berikut hanya-baca dari salinan terakhir.',
  isLoading = false,
  skeletonRows,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  onRowOpen,
  rowAriaLabel,
  rowActions,
  selection,
  dense = false,
  ariaLabel,
}: VelzonDataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterValue, setFilterValue] = useState<string>(ALL_FILTER_VALUE);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const columnByKey = useMemo(() => {
    const map = new Map<string, ColumnDef<T>>();
    for (const col of columns) map.set(col.key, col);
    return map;
  }, [columns]);

  const filteredData = useMemo(() => {
    let rows: readonly T[] = data;

    if (filter && filterValue !== ALL_FILTER_VALUE) {
      rows = rows.filter((row) => (filter.accessor(row) ?? '') === filterValue);
    }

    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((key) => {
          const value = row[key];
          return value !== null && value !== undefined && String(value).toLowerCase().includes(term);
        });
      }
      return Object.values(row as Record<string, unknown>).some((value) => {
        return value !== null && value !== undefined && String(value).toLowerCase().includes(term);
      });
    });
  }, [data, searchTerm, searchKeys, filter, filterValue]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    const column = columnByKey.get(sortKey) ?? null;
    const read = (row: T): unknown => {
      if (column?.sortValue) return column.sortValue(row);
      return (row as Record<string, unknown>)[column ? column.key : sortKey];
    };

    return [...filteredData].sort((a, b) => {
      const aVal = read(a);
      const bVal = read(b);

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal).toLowerCase();
      const strB = String(bVal).toLowerCase();
      return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [filteredData, sortKey, sortOrder, columnByKey]);

  const totalRecords = sortedData.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize) || 1);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, pagination, currentPage, pageSize]);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortOrder('asc');
      } else if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
      setCurrentPage(1);
    },
    [sortKey, sortOrder],
  );

  const resetPage = useCallback(() => setCurrentPage(1), []);

  const cellPad = dense ? 'px-3.5 py-2.5' : 'px-4 py-3.5';
  const headPad = dense ? 'px-3.5 py-2' : 'px-4 py-3';
  const bodyText = dense ? 'text-[13px]' : 'text-[13.5px]';

  const hasHeader = Boolean(title || subtitle || eyebrow || filter || toolbar || actions) || searchable;

  /* Aksi baris dirender inline sebagai ikon. Dropdown di dalam baris sengaja
     tidak dipakai: wadah gulir tabel (`overflow-x-auto`) akan memotong menunya. */
  const inlineActions = rowActions ?? [];
  const hasActionColumn = inlineActions.length > 0;

  const columnCount = columns.length + (selection ? 1 : 0) + (hasActionColumn ? 1 : 0);

  const defaultCell = (col: ColumnDef<T>, row: T): React.ReactNode => {
    if (col.valueType === 'status') {
      const status = col.statusValue ? col.statusValue(row) : (row as Record<string, unknown>)[col.key];
      return <StatusBadge status={status === null || status === undefined ? null : String(status)} />;
    }

    const raw = (row as Record<string, unknown>)[col.key];
    if (raw === null || raw === undefined || raw === '') {
      return <span className="text-slate-400">—</span>;
    }
    if (col.valueType === 'number' || typeof raw === 'number') {
      return <span className="tabular">{String(raw)}</span>;
    }
    return String(raw);
  };

  const pageRows = paginatedData;
  const selectableRows = selection ? pageRows.filter((row) => !selection.isDisabled?.(row)) : [];
  const selectedOnPage = selection ? selectableRows.filter((row) => selection.isSelected(row)).length : 0;

  const rangeFrom = totalRecords === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeTo = Math.min(currentPage * pageSize, totalRecords);

  return (
    <section className="card" aria-busy={isLoading} aria-label={ariaLabel ?? title}>
      {hasHeader ? (
        <div className="card-header flex-wrap items-center">
          {(title || subtitle || eyebrow) && (
            <div className="flex min-w-0 flex-col gap-0.5">
              {eyebrow ? <p className="section-label">{eyebrow}</p> : null}
              {title ? <h3 className="card-title">{title}</h3> : null}
              {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
            </div>
          )}

          <div className="ml-auto flex flex-wrap items-center justify-end gap-2.5">
            {searchable ? (
              <Input
                type="search"
                startIcon={<Search size={15} strokeWidth={2} aria-hidden />}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  resetPage();
                }}
                className="w-52 sm:w-64"
              />
            ) : null}

            {filter ? (
              <Dropdown
                align="end"
                width="w-56"
                trigger={(open) => (
                  <span
                    className={cn(
                      'inline-flex h-10 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors duration-150',
                      filterValue !== ALL_FILTER_VALUE
                        ? 'btn-soft-primary border-primary/25'
                        : 'border-[color:var(--sica-border-color)] text-slate-600 hover:bg-slate-50/70',
                    )}
                  >
                    <SlidersHorizontal size={15} strokeWidth={2} aria-hidden />
                    {filter.label}
                    <ChevronDown
                      size={14}
                      strokeWidth={2}
                      aria-hidden
                      className={cn('transition-transform duration-200 ease-velzon', open && 'rotate-180')}
                    />
                  </span>
                )}
              >
                {(close) => (
                  <>
                    <DropdownLabel>{filter.label}</DropdownLabel>
                    <DropdownItem
                      icon={filterValue === ALL_FILTER_VALUE ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                      onSelect={() => {
                        setFilterValue(ALL_FILTER_VALUE);
                        resetPage();
                        close();
                      }}
                    >
                      {filter.allLabel ?? 'Semua data'}
                    </DropdownItem>
                    {filter.options.map((option) => (
                      <DropdownItem
                        key={option.value}
                        icon={filterValue === option.value ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                        onSelect={() => {
                          setFilterValue(option.value);
                          resetPage();
                          close();
                        }}
                      >
                        {option.label}
                      </DropdownItem>
                    ))}
                  </>
                )}
              </Dropdown>
            ) : null}

            {toolbar}
            {actions}
          </div>
        </div>
      ) : null}

      {offline && !error ? (
        <div className="flex items-center gap-2.5 border-b bg-warning-soft px-5 py-2.5 text-[12.5px] font-medium text-[color:var(--sica-warning-hover)]">
          <WifiOff size={15} strokeWidth={2} aria-hidden />
          <span>{offlineMessage}</span>
        </div>
      ) : null}

      <div
        className={cn(
          'w-full overflow-x-auto overflow-y-hidden',
          !hasHeader && !offline && 'rounded-t-[var(--sica-radius-lg)]',
        )}
      >
        <table className="w-full border-collapse text-left text-slate-600">
          <thead>
            <tr className="table-head">
              {selection ? (
                <th scope="col" className={cn(headPad, 'w-11 text-center')}>
                  <GridCheckbox
                    label={selection.label ?? 'Pilih semua baris pada halaman ini'}
                    checked={selectableRows.length > 0 && selectedOnPage === selectableRows.length}
                    indeterminate={selectedOnPage > 0 && selectedOnPage < selectableRows.length}
                    disabled={selectableRows.length === 0}
                    onChange={() => {
                      const next = selectedOnPage !== selectableRows.length;
                      if (selection.onSelectMany) {
                        selection.onSelectMany(selectableRows, next);
                      } else {
                        for (const row of selectableRows) {
                          if (selection.isSelected(row) !== next) selection.onToggle(row);
                        }
                      }
                      resetPage();
                    }}
                  />
                </th>
              ) : null}

              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                const sortable = col.sortable !== false;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    style={{ width: col.width }}
                    className={cn(headPad, 'whitespace-nowrap text-[11px] font-semibold text-slate-500', alignClass(col.align))}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        aria-label={`Urutkan berdasarkan ${col.header}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded uppercase tracking-[0.06em] transition-colors duration-150 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/15',
                          isSorted && 'text-primary-hover',
                          col.align === 'right' && 'flex-row-reverse',
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sortOrder === 'asc' ? (
                            <ArrowUp size={12} strokeWidth={2.4} aria-hidden />
                          ) : (
                            <ArrowDown size={12} strokeWidth={2.4} aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown size={12} strokeWidth={2} aria-hidden className="opacity-45" />
                        )}
                      </button>
                    ) : (
                      <span className="uppercase tracking-[0.06em]">{col.header}</span>
                    )}
                  </th>
                );
              })}

              {hasActionColumn ? (
                <th scope="col" className={cn(headPad, 'w-24 text-right')}>
                  <span className="uppercase tracking-[0.06em]">Aksi</span>
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRows ?? Math.min(pageSize, 6) }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`} className="table-row">
                  {selection ? (
                    <td className={cn(cellPad, 'text-center')}>
                      <Skeleton className="mx-auto h-4 w-4 rounded" />
                    </td>
                  ) : null}
                  {columns.map((col, colIndex) => (
                    <td key={col.key} className={cn(cellPad, alignClass(col.align))}>
                      <Skeleton className={colIndex === 0 ? 'h-3.5 w-40' : 'h-3.5 w-20'} />
                    </td>
                  ))}
                  {hasActionColumn ? (
                    <td className={cn(cellPad, 'text-right')}>
                      <Skeleton className="ml-auto h-6 w-16 rounded-full" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : error ? (
              <tr>
                <td colSpan={columnCount} className={cn(cellPad, 'text-center')}>
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 py-8">
                    <span className="badge-soft-danger flex h-11 w-11 items-center justify-center rounded-full">
                      <AlertTriangle size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <p className="text-sm font-semibold text-[color:var(--sica-text-heading)]">Data gagal dimuat</p>
                    {error.code ? <Badge tone="danger" look="label" size="sm">{error.code}</Badge> : null}
                    <p className="text-[13px] leading-relaxed text-slate-500">{error.message}</p>
                    {error.onRetry ? (
                      <Button variant="label" size="sm" className="mt-1" onClick={error.onRetry}>
                        {error.retryLabel ?? 'Muat ulang'}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className={cn(cellPad, 'text-center')}>
                  <div className="mx-auto flex max-w-md flex-col items-center gap-2.5 py-9">
                    <span className="badge-soft-secondary flex h-11 w-11 items-center justify-center rounded-full">
                      <Inbox size={18} strokeWidth={2} aria-hidden />
                    </span>
                    <p className="text-sm font-semibold text-[color:var(--sica-text-heading)]">
                      {searchTerm.trim() || filterValue !== ALL_FILTER_VALUE
                        ? 'Tidak ada hasil'
                        : (emptyState?.title ?? 'Data masih kosong')}
                    </p>
                    <p className="text-[13px] leading-relaxed text-slate-500">
                      {searchTerm.trim() || filterValue !== ALL_FILTER_VALUE
                        ? 'Tidak ada baris yang cocok dengan kata kunci atau filter aktif.'
                        : (emptyState?.description ?? emptyMessage)}
                    </p>
                    {searchTerm.trim() || filterValue !== ALL_FILTER_VALUE ? (
                      <Button
                        variant="soft"
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          setSearchTerm('');
                          setFilterValue(ALL_FILTER_VALUE);
                          resetPage();
                        }}
                      >
                        Bersihkan filter
                      </Button>
                    ) : emptyState?.onAction && emptyState.actionLabel ? (
                      <Button variant="soft" size="sm" className="mt-1" onClick={emptyState.onAction}>
                        {emptyState.actionLabel}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIndex) => {
                const key = keyExtractor(row);
                const interactive = Boolean(onRowOpen);
                const isSelected = selection ? selection.isSelected(row) : false;

                return (
                  <tr
                    key={key}
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    aria-label={
                      interactive
                        ? (rowAriaLabel?.(row) ?? `Buka detail data ${keyExtractor(row)}`)
                        : undefined
                    }
                    onClick={interactive ? () => onRowOpen?.(row) : undefined}
                    onKeyDown={
                      interactive
                        ? (event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              onRowOpen?.(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      'table-row transition-colors duration-150 hover:bg-slate-50/70',
                      interactive &&
                        'cursor-pointer focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-primary/20',
                      isSelected && 'bg-primary-soft hover:bg-primary-soft',
                    )}
                  >
                    {selection ? (
                      <td className={cn(cellPad, 'text-center')} onClick={(event) => event.stopPropagation()}>
                        <GridCheckbox
                          label={selection.label ?? `Pilih baris ${key}`}
                          checked={isSelected}
                          disabled={selection.isDisabled?.(row) ?? false}
                          onChange={() => selection.onToggle(row)}
                        />
                      </td>
                    ) : null}

                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(cellPad, 'align-middle text-slate-600', bodyText, alignClass(col.align))}
                      >
                        {col.render
                          ? col.render(row, pagination ? (currentPage - 1) * pageSize + rowIndex : rowIndex)
                          : defaultCell(col, row)}
                      </td>
                    ))}

                    {hasActionColumn ? (
                      <td className={cn(cellPad, 'text-right')} onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {inlineActions.map((action) => {
                            const disabled = action.isDisabled?.(row) ?? false;
                            return (
                              <Button
                                key={action.id}
                                type="button"
                                size="icon-sm"
                                variant={action.tone === 'danger' ? 'soft' : 'ghost'}
                                aria-label={`${action.label}${disabled ? ' (tidak tersedia)' : ''}`}
                                title={action.label}
                                disabled={disabled}
                                className={cn(
                                  'rounded-full',
                                  action.tone === 'danger' &&
                                    'border-danger/25 bg-danger-soft text-danger-hover hover:bg-danger/15',
                                )}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  action.onSelect(row);
                                }}
                              >
                                {action.icon}
                              </Button>
                            );
                          })}
                        </div>
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination && !error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--sica-divider)] px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12.5px] text-slate-500 tabular">
              Menampilkan <span className="font-semibold text-slate-700">{rangeFrom}–{rangeTo}</span> dari{' '}
              <span className="font-semibold text-slate-700">{totalRecords}</span> data
            </p>
            <Dropdown
              align="start"
              width="w-40"
              trigger={() => (
                <span className="btn-soft-secondary inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-semibold tabular">
                  {pageSize} / hal.
                  <ChevronDown size={13} strokeWidth={2} aria-hidden />
                </span>
              )}
            >
              {(close) => (
                <>
                  <DropdownLabel>Baris per halaman</DropdownLabel>
                  {pageSizeOptions.map((size) => (
                    <DropdownItem
                      key={size}
                      icon={size === pageSize ? <Check size={14} strokeWidth={2} aria-hidden /> : null}
                      onSelect={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                        close();
                      }}
                    >
                      <span className="tabular">{size}</span>
                    </DropdownItem>
                  ))}
                </>
              )}
            </Dropdown>
          </div>

          <nav aria-label="Navigasi halaman" className="flex items-center gap-1">
            <Button
              size="icon-sm"
              variant="soft"
              className="rounded-full"
              aria-label="Halaman pertama"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(1)}
            >
              <ChevronsLeft size={15} strokeWidth={2} aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="soft"
              className="rounded-full"
              aria-label="Halaman sebelumnya"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={15} strokeWidth={2} aria-hidden />
            </Button>

            <span className="mx-1 flex items-center gap-1">
              {buildPageWindow(currentPage, totalPages).map((item, index) =>
                item === 'gap' ? (
                  <span key={`gap-${index}`} className="px-0.5 text-[13px] text-slate-400" aria-hidden>
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    size="icon-sm"
                    variant={item === currentPage ? 'soft' : 'ghost'}
                    aria-label={`Halaman ${item}`}
                    aria-current={item === currentPage ? 'page' : undefined}
                    className={cn(
                      'rounded-full tabular',
                      item === currentPage ? 'border border-primary/25 font-semibold' : 'text-slate-500',
                    )}
                    onClick={() => setCurrentPage(item)}
                  >
                    {item}
                  </Button>
                ),
              )}
            </span>

            <Button
              size="icon-sm"
              variant="soft"
              className="rounded-full"
              aria-label="Halaman berikutnya"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            >
              <ChevronRight size={15} strokeWidth={2} aria-hidden />
            </Button>
            <Button
              size="icon-sm"
              variant="soft"
              className="rounded-full"
              aria-label="Halaman terakhir"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
            >
              <ChevronsRight size={15} strokeWidth={2} aria-hidden />
            </Button>
          </nav>
        </div>
      ) : null}
    </section>
  );
}
