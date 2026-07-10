import React, { useState, useMemo } from 'react';
import { Search, Filter, ChevronUp, ChevronDown } from 'lucide-react';

interface Column<T> {
  header: string;
  accessor: keyof T | string | ((row: T) => React.ReactNode);
  className?: string;
  sortable?: boolean;
  filterKey?: keyof T; // Used for dropdown filter
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  searchPlaceholder?: string;
  searchKeys?: (keyof T | string)[]; // Fields to match search query
  defaultSortField?: keyof T | string;
}

export function Table<T extends { id: string | number }>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No records found',
  onRowClick,
  searchPlaceholder = 'Search records...',
  searchKeys = [],
  defaultSortField = '',
}: TableProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>(defaultSortField as string);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Custom dropdown filters state
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});
  
  // 1. Extract filter options for columns that specify filterKey
  const filterOptions = useMemo(() => {
    const options: Record<string, Set<string>> = {};
    columns.forEach(col => {
      if (col.filterKey) {
        const key = col.filterKey as string;
        options[key] = new Set<string>();
        data.forEach(row => {
          const val = row[col.filterKey as keyof T];
          if (val !== undefined && val !== null) {
            options[key].add(String(val));
          }
        });
      }
    });
    return options;
  }, [columns, data]);

  // 2. Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // 3. Filter and search logic
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply dropdown filters
    Object.entries(activeFilters).forEach(([key, filterVal]) => {
      if (filterVal) {
        result = result.filter(row => String((row as any)[key]) === filterVal);
      }
    });

    // Apply text search
    if (searchQuery.trim() && searchKeys.length > 0) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(row => 
        searchKeys.some(key => {
          const val = (row as any)[key];
          return val && String(val).toLowerCase().includes(query);
        })
      );
    }

    // Apply sorting
    if (sortField) {
      result.sort((a, b) => {
        let valA = a[sortField as keyof T] as any;
        let valB = b[sortField as keyof T] as any;

        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();

        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;

        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, activeFilters, searchQuery, searchKeys, sortField, sortDirection]);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedData, currentPage]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage) || 1;

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilters]);

  return (
    <div className="space-y-4 w-full">
      {/* Search & Filters Toolbar */}
      {(searchKeys.length > 0 || Object.keys(filterOptions).length > 0) && (
        <div className="flex flex-col sm:flex-row items-center gap-3 justify-between">
          {searchKeys.length > 0 && (
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 text-slate-700 dark:text-slate-200 transition-colors"
              />
            </div>
          )}

          {/* Dynamic Dropdown Filters */}
          {Object.keys(filterOptions).length > 0 && (
            <div className="flex items-center gap-2 self-end sm:self-auto w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0">
                <Filter className="h-3 w-3" /> Filters:
              </span>
              {columns.map((col, idx) => {
                if (!col.filterKey) return null;
                const key = col.filterKey as string;
                return (
                  <select
                    key={idx}
                    value={activeFilters[key] || ''}
                    onChange={(e) => setActiveFilters(prev => ({ ...prev, [key]: e.target.value }))}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-500 text-slate-600 dark:text-slate-300 font-medium"
                  >
                    <option value="">All {col.header}s</option>
                    {Array.from(filterOptions[key]).map((opt, oIdx) => (
                      <option key={oIdx} value={opt}>{opt}</option>
                    ))}
                  </select>
                );
              })}
              {Object.values(activeFilters).some(v => v !== '') && (
                <button
                  onClick={() => setActiveFilters({})}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600 shrink-0 cursor-pointer"
                >
                  Clear all
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Responsive Table */}
      <div className="overflow-x-auto w-full border border-slate-200/50 dark:border-slate-800/80 rounded-2xl bg-white/50 dark:bg-slate-950/40 backdrop-blur-md shadow-sm">
        <table className="min-w-full divide-y divide-slate-200/50 dark:divide-slate-800/50">
          <thead className="bg-slate-50/50 dark:bg-slate-900/50">
            <tr>
              {columns.map((col, index) => {
                const isSortActive = col.sortable && col.accessor && typeof col.accessor === 'string';
                return (
                  <th
                    key={index}
                    scope="col"
                    onClick={() => isSortActive && handleSort(col.accessor as string)}
                    className={`px-6 py-3.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ${isSortActive ? 'cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200' : ''} ${col.className || ''}`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.header}</span>
                      {isSortActive && (
                        sortField === col.accessor ? (
                          sortDirection === 'asc' ? <ChevronUp className="h-3.5 w-3.5 text-brand-500" /> : <ChevronDown className="h-3.5 w-3.5 text-brand-500" />
                        ) : (
                          <ChevronUp className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/40 dark:divide-slate-800/40 bg-transparent">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
                  <p className="mt-2 text-xs font-medium text-slate-400">Querying active ENOS controllers...</p>
                </td>
              </tr>
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-16 text-center text-xs font-medium text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onRowClick?.(row)}
                  className={`transition-colors duration-150 ${onRowClick ? 'hover:bg-slate-500/5 dark:hover:bg-slate-400/5 cursor-pointer' : ''}`}
                >
                  {columns.map((col, colIndex) => {
                    const content =
                      typeof col.accessor === 'function'
                        ? col.accessor(row)
                        : (row[col.accessor as keyof T] as React.ReactNode);

                    return (
                      <td
                        key={colIndex}
                        className={`px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-slate-300 ${col.className || ''}`}
                      >
                        {content}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 text-xs">
          <span className="text-slate-400 font-medium">
            Showing <span className="font-semibold text-slate-600 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-600 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, filteredAndSortedData.length)}</span> of <span className="font-semibold text-slate-600 dark:text-slate-200">{filteredAndSortedData.length}</span> entries
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-500/5 transition-colors cursor-pointer text-slate-600 dark:text-slate-300 font-medium"
            >
              Previous
            </button>
            <span className="text-slate-500 font-semibold px-2">Page {currentPage} of {totalPages}</span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 disabled:opacity-40 hover:bg-slate-500/5 transition-colors cursor-pointer text-slate-600 dark:text-slate-300 font-medium"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
