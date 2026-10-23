import { useCallback, useEffect, useRef, useState } from 'react';
import type { Student } from '../types';
import { dbRefreshKey } from './localDb';
import { isClassMatch, studentMatchesQuery } from './digitUtils';

export type StudentStorageKey = 'samdani_students' | 'samdani_hifz_students';

export interface UseLiveStudentSearchOptions {
  /** Supabase kv_store key to re-fetch on every search. */
  storageKey: StudentStorageKey;
  /** Fallback list (current React state) if the network fetch fails. */
  fallbackStudents: Student[];
  classFilter?: string;
  /** Debounce delay in ms before hitting Supabase. */
  debounceMs?: number;
}

export interface UseLiveStudentSearchResult {
  query: string;
  setQuery: (q: string) => void;
  classFilter: string;
  setClassFilter: (c: string) => void;
  /** Filtered students from the latest live fetch. */
  results: Student[];
  /** True while debounce is pending or a Supabase fetch is in flight. */
  loading: boolean;
  /**
   * Bumps on every completed search. Put this on the results container
   * (`key={renderKey}`) so React always remounts the list — fixes the
   * "results only appear after switching tabs" stale-DOM bug caused by
   * duplicate student IDs.
   */
  renderKey: number;
  /** Total students in the last fetched snapshot (before filter). */
  totalCount: number;
  /** Manually re-run the live fetch (e.g. refresh button). */
  refresh: () => void;
}

function filterStudents(list: Student[], query: string, classFilter: string): Student[] {
  return list.filter(
    (s) => studentMatchesQuery(s, query) && isClassMatch(s.class, classFilter)
  );
}

/**
 * Interactive student directory search:
 * 1. Shows loading immediately when the user types
 * 2. Debounces, then pulls fresh data from Supabase (no stale cache)
 * 3. Filters by name / id / roll / phone (Bengali + English)
 * 4. Remounts results via renderKey so the UI always updates in real time
 */
export function useLiveStudentSearch({
  storageKey,
  fallbackStudents,
  classFilter: initialClassFilter = 'All',
  debounceMs = 280,
}: UseLiveStudentSearchOptions): UseLiveStudentSearchResult {
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState(initialClassFilter);
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Student[]>(() =>
    filterStudents(fallbackStudents, '', initialClassFilter)
  );
  const [totalCount, setTotalCount] = useState(fallbackStudents.length);
  const [renderKey, setRenderKey] = useState(0);
  const [refreshTick, setRefreshTick] = useState(0);

  const fallbackRef = useRef(fallbackStudents);
  fallbackRef.current = fallbackStudents;

  const requestId = useRef(0);

  // Debounce the query; flip loading on as soon as the user types.
  useEffect(() => {
    setLoading(true);
    const t = window.setTimeout(() => setDebouncedQuery(query), debounceMs);
    return () => window.clearTimeout(t);
  }, [query, debounceMs]);

  // Keep class filter changes interactive too.
  useEffect(() => {
    setLoading(true);
  }, [classFilter]);

  // Live Supabase fetch + filter whenever the debounced query / class / refresh changes.
  useEffect(() => {
    const id = ++requestId.current;
    let cancelled = false;

    (async () => {
      setLoading(true);
      let list: Student[] = Array.isArray(fallbackRef.current) ? fallbackRef.current : [];

      try {
        const fresh = await dbRefreshKey(storageKey);
        if (Array.isArray(fresh)) list = fresh as Student[];
      } catch {
        /* keep fallback */
      }

      if (cancelled || id !== requestId.current) return;

      // Normalize so search never crashes on numeric rolls / missing fields.
      const normalized = list.map((s, idx) => ({
        ...s,
        id: s?.id != null && String(s.id).trim() !== '' ? String(s.id) : `missing-${idx}`,
        name: s?.name != null ? String(s.name) : '',
        roll: s?.roll != null ? String(s.roll) : '',
        contact: s?.contact != null ? String(s.contact) : '',
        class: s?.class != null ? String(s.class) : '',
      }));

      const filtered = filterStudents(normalized, debouncedQuery, classFilter);

      setTotalCount(normalized.length);
      setResults(filtered);
      // Force a brand-new results tree so duplicate React keys cannot leave a stale DOM.
      setRenderKey((k) => k + 1);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, classFilter, storageKey, refreshTick]);

  // When parent fallback list changes (realtime sync) and user isn't mid-search,
  // refresh results from the new snapshot without waiting for another keystroke.
  useEffect(() => {
    if (loading) return;
    if (query.trim() !== debouncedQuery.trim()) return;
    const filtered = filterStudents(fallbackStudents, debouncedQuery, classFilter);
    setTotalCount(fallbackStudents.length);
    setResults(filtered);
    setRenderKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to inbound student list changes
  }, [fallbackStudents]);

  const refresh = useCallback(() => {
    setLoading(true);
    setRefreshTick((n) => n + 1);
  }, []);

  return {
    query,
    setQuery,
    classFilter,
    setClassFilter,
    results,
    loading,
    renderKey,
    totalCount,
    refresh,
  };
}
