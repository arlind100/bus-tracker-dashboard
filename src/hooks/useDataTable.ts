import { useMemo, useState } from 'react';

/**
 * Client-side search + pagination for list pages. Filtering runs against a
 * caller-provided text accessor; paging resets to page 1 whenever the filtered
 * result set shrinks below the current page.
 */
export function useDataTable<T>({
  items,
  searchText,
  pageSize = 10,
}: {
  items: T[];
  searchText: (item: T) => string;
  pageSize?: number;
}) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(item => searchText(item).toLowerCase().includes(q));
  }, [items, query, searchText]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);

  const paged = useMemo(
    () => filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize],
  );

  const onQueryChange = (value: string) => {
    setQuery(value);
    setPage(1);
  };

  return {
    query,
    setQuery: onQueryChange,
    page: safePage,
    setPage,
    paged,
    total: filtered.length,
    pageCount,
    pageSize,
  };
}
