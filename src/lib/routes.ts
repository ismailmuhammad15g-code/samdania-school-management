// Central mapping between the app's top-level navigation tabs and real URL paths.
// This lets the navbar use shareable URLs (e.g. /home, /students) while the app
// stays a single-page application driven by the `activeTab` state.

export type AppTab =
  | 'dashboard'
  | 'finance'
  | 'fees'
  | 'salaries'
  | 'results'
  | 'loans'
  | 'settings'
  | 'closing'
  | 'hifz'
  | 'summary'
  | 'pending'
  | 'assistant'
  | 'appManagement'
  | 'missingFillouts';

export const TAB_PATHS: Record<AppTab, string> = {
  dashboard: '/home',
  finance: '/finance',
  fees: '/students',
  salaries: '/teachers',
  results: '/results',
  loans: '/loans',
  settings: '/settings',
  closing: '/closing',
  hifz: '/hifz',
  summary: '/summary',
  pending: '/pending',
  assistant: '/assistant',
  appManagement: '/app-management',
  missingFillouts: '/missing-fillouts',
};

const PATH_TABS: Record<string, AppTab> = Object.entries(TAB_PATHS).reduce(
  (acc, [tab, path]) => {
    acc[path] = tab as AppTab;
    return acc;
  },
  {} as Record<string, AppTab>
);

export function tabToPath(tab: AppTab): string {
  return TAB_PATHS[tab];
}

export function pathToTab(path: string): AppTab | null {
  const clean = path.replace(/\/+$/, '') || '/';
  return PATH_TABS[clean] ?? null;
}
