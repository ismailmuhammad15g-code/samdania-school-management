import { useSyncExternalStore } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getDbStatus, retryDbConnection, subscribeDbStatus, type DbStatus } from '../lib/localDb';

export function useDbStatus(): DbStatus {
  return useSyncExternalStore(subscribeDbStatus, getDbStatus);
}

/** True while the first load has failed and the app must not be used yet. */
export function isDbUnavailable(status: DbStatus): boolean {
  return status.state === 'offline' || (status.state === 'connecting' && status.loadError !== null);
}

/** Shown instead of the app when the database could not be loaded — nothing can be changed or lost. */
export function DatabaseOfflineScreen({ status }: { status: DbStatus }) {
  const retrying = status.state === 'connecting';
  return (
    <div className="min-h-screen bg-[#f8f7f4] flex items-center justify-center p-6" role="alert">
      <div className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
          <h1 className="text-base font-bold text-[#2c332d]">Cannot reach the database</h1>
        </div>
        <p className="mt-3 text-sm text-stone-700">{status.loadError || 'Connecting to the database…'}</p>
        <p className="mt-3 text-xs text-stone-500">
          Your records are safe: the software will not save or change anything until the database has loaded, and it keeps retrying on its own.
        </p>
        <p className="mt-1 text-xs text-stone-500">ডাটাবেসের সাথে সংযোগ হচ্ছে না — আপনার তথ্য নিরাপদ আছে, কিছু পরিবর্তন হয়নি।</p>
        <button
          type="button"
          disabled={retrying}
          onClick={() => void retryDbConnection()}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#4a5d4e] px-4 py-2 text-xs font-bold text-white disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
          {retrying ? 'Retrying…' : 'Retry now'}
        </button>
      </div>
    </div>
  );
}

/** Warns when data is not being saved (database not configured, or saves are failing). */
export function DatabaseStatusBanner() {
  const status = useDbStatus();

  let text: string | null = null;
  let tone = 'bg-amber-100 text-amber-900 border-amber-300';
  if (status.state === 'unconfigured') {
    text = 'No database is configured — nothing you enter will be saved. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.';
    tone = 'bg-red-100 text-red-900 border-red-300';
  } else if (status.state === 'online' && status.unsaved > 0 && status.saveError) {
    text = `${status.unsaved} change${status.unsaved === 1 ? ' is' : 's are'} not saved yet: ${status.saveError} Keep this page open — saving is retried automatically.`;
  }
  if (!text) return null;

  return (
    <div className={`fixed inset-x-0 top-0 z-[100] border-b px-4 py-2 text-center text-xs font-semibold ${tone}`} role="alert">
      {text}
    </div>
  );
}
