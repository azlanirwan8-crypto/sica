'use client';

import React, { useState, useMemo } from 'react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, index: number) => React.ReactNode;
}

export interface VelzonDataGridProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
  title?: string;
  subtitle?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pagination?: boolean;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  actions?: React.ReactNode;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function VelzonDataGrid<T>({
  columns,
  data,
  keyExtractor,
  title,
  subtitle,
  searchable = true,
  searchPlaceholder = 'Cari data...',
  searchKeys,
  pagination = true,
  defaultPageSize = 10,
  pageSizeOptions = [10, 25, 50],
  actions,
  emptyMessage = 'Tidak ada data ditemukan.',
  isLoading = false,
}: VelzonDataGridProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // 1. Filtering logic
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const lowerSearch = searchTerm.toLowerCase();

    return data.filter((row) => {
      if (searchKeys && searchKeys.length > 0) {
        return searchKeys.some((k) => {
          const val = row[k];
          return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerSearch);
        });
      }
      return Object.values(row as Record<string, unknown>).some((val) => {
        return val !== null && val !== undefined && String(val).toLowerCase().includes(lowerSearch);
      });
    });
  }, [data, searchTerm, searchKeys]);

  // 2. Sorting logic
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[sortKey];
      const bVal = (b as Record<string, unknown>)[sortKey];

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
  }, [filteredData, sortKey, sortOrder]);

  // 3. Pagination logic
  const totalRecords = sortedData.length;
  const totalPages = Math.ceil(totalRecords / pageSize) || 1;
  const paginatedData = useMemo(() => {
    if (!pagination) return sortedData;
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, pagination, currentPage, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') {
        setSortOrder('desc');
      } else {
        setSortKey(null);
        setSortOrder('asc');
      }
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div
      style={{
        backgroundColor: 'var(--sica-surface-card)',
        borderRadius: 'var(--sica-radius-lg)',
        border: '1px solid var(--sica-border-color)',
        boxShadow: 'var(--sica-shadow-card)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header bar */}
      {(title || searchable || actions) && (
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--sica-border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {title && (
            <div>
              <h3
                style={{
                  fontSize: '15px',
                  fontWeight: 700,
                  color: 'var(--sica-text-heading)',
                  margin: 0,
                }}
              >
                {title}
              </h3>
              {subtitle && (
                <p
                  style={{
                    fontSize: '12px',
                    color: 'var(--sica-text-muted)',
                    margin: '3px 0 0 0',
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
            {searchable && (
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    height: '36px',
                    padding: '0 14px 0 32px',
                    borderRadius: 'var(--sica-radius-md)',
                    border: '1px solid var(--sica-border-color)',
                    fontSize: '12px',
                    backgroundColor: 'var(--sica-surface-input)',
                    color: 'var(--sica-text-heading)',
                    outline: 'none',
                    minWidth: '220px',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--sica-text-muted)',
                    fontSize: '14px',
                    pointerEvents: 'none',
                  }}
                >
                  🔍
                </span>
              </div>
            )}
            {actions}
          </div>
        </div>
      )}

      {/* Table container */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            textAlign: 'left',
          }}
        >
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--sica-surface-hover)',
                borderBottom: '1px solid var(--sica-border-color)',
              }}
            >
              {columns.map((col) => {
                const isSorted = sortKey === col.key;
                return (
                  <th
                    key={col.key}
                    onClick={() => col.sortable !== false && handleSort(col.key)}
                    style={{
                      padding: '12px 16px',
                      color: 'var(--sica-text-muted)',
                      fontWeight: 600,
                      fontSize: '12px',
                      letterSpacing: '0.3px',
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable !== false ? 'pointer' : 'default',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {col.header}
                      {col.sortable !== false && (
                        <span style={{ fontSize: '10px', color: isSorted ? 'var(--sica-color-primary)' : '#c4c8d0' }}>
                          {isSorted ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    color: 'var(--sica-text-muted)',
                  }}
                >
                  Memuat data...
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{
                    padding: '36px',
                    textAlign: 'center',
                    color: 'var(--sica-text-muted)',
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row, idx) => (
                <tr
                  key={keyExtractor(row)}
                  style={{
                    borderBottom: '1px solid var(--sica-border-color)',
                    transition: 'background-color 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--sica-surface-hover)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '14px 16px',
                        color: 'var(--sica-text-body)',
                        textAlign: col.align || 'left',
                        verticalAlign: 'middle',
                      }}
                    >
                      {col.render
                        ? col.render(row, (currentPage - 1) * pageSize + idx)
                        : String((row as Record<string, unknown>)[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {pagination && (
        <div
          style={{
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid var(--sica-border-color)',
            fontSize: '12px',
            color: 'var(--sica-text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{
                height: '28px',
                padding: '0 6px',
                borderRadius: 'var(--sica-radius-sm)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: 'var(--sica-surface-input)',
                color: 'var(--sica-text-heading)',
                fontSize: '12px',
              }}
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>dari total {totalRecords} entri</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--sica-radius-sm)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: currentPage <= 1 ? 'var(--sica-surface-hover)' : 'var(--sica-surface-card)',
                color: currentPage <= 1 ? '#c4c8d0' : 'var(--sica-text-body)',
                cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              Prev
            </button>
            <span style={{ fontWeight: 600, color: 'var(--sica-text-heading)' }}>
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              style={{
                padding: '4px 10px',
                borderRadius: 'var(--sica-radius-sm)',
                border: '1px solid var(--sica-border-color)',
                backgroundColor: currentPage >= totalPages ? 'var(--sica-surface-hover)' : 'var(--sica-surface-card)',
                color: currentPage >= totalPages ? '#c4c8d0' : 'var(--sica-text-body)',
                cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                fontSize: '12px',
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
