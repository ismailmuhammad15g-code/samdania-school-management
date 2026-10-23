import React from 'react';
import { ClipboardList, CheckCircle2, XCircle, UserMinus, Clock, Mail, FileText } from 'lucide-react';
import type { TeacherResignationRequest } from '../types';

interface PendingOperationsProps {
  resignations: TeacherResignationRequest[];
  onResolve: (requestId: string, approve: boolean) => void;
  readOnly?: boolean;
}

export default function PendingOperations({ resignations, onResolve, readOnly }: PendingOperationsProps) {
  const pending = resignations.filter((r) => r.status === 'pending');
  const resolved = resignations.filter((r) => r.status !== 'pending');

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="max-w-3xl mx-auto w-full space-y-5">
      {/* Pending teacher resignations */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Pending Teacher Resignations</h3>
          <span className={`ml-auto text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${pending.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'}`}>
            {pending.length} waiting
          </span>
        </div>
        <div className="p-5 space-y-3">
          {pending.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-6">No pending resignation requests. (কোনো অপেক্ষমাণ পদত্যাগ নেই)</p>
          ) : (
            pending.map((r) => (
              <div key={r.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#2c332d] flex items-center gap-2">
                      <UserMinus className="h-4 w-4 text-amber-600 shrink-0" />
                      {r.teacherName}
                    </p>
                    <p className="text-[11px] text-stone-500 flex items-center gap-1.5 mt-0.5">
                      <Mail className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      {r.teacherEmail}
                    </p>
                    <p className="text-[11px] text-stone-400 flex items-center gap-1.5 mt-0.5">
                      <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
                      Requested: {fmt(r.requestedAt)}
                    </p>
                    {r.reason && (
                      <p className="text-[11px] text-stone-600 flex items-start gap-1.5 mt-1.5">
                        <FileText className="h-3.5 w-3.5 text-stone-400 shrink-0 mt-0.5" />
                        <span className="break-words">{r.reason}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    {!readOnly && (
                      <>
                        <button
                          onClick={() => onResolve(r.id, true)}
                          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-emerald-700"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Approve (অনুমোদন)
                        </button>
                        <button
                          onClick={() => onResolve(r.id, false)}
                          className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-red-700"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Reject (বাতিল)
                        </button>
                      </>
                    )}
                    {readOnly && (
                      <span className="text-[10px] font-bold text-stone-400 uppercase bg-stone-100 px-2 py-1 rounded-full">View only</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Resolved history */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Resolved (সমাধানকৃত)</h3>
          <span className="ml-auto text-[10px] font-bold uppercase text-stone-400">{resolved.length}</span>
        </div>
        <div className="p-5 space-y-2">
          {resolved.length === 0 ? (
            <p className="text-xs text-stone-500 text-center py-6">No resolved requests yet. (কোনো সমাধানকৃত অনুরোধ নেই)</p>
          ) : (
            resolved.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#2c332d] truncate">{r.teacherName}</p>
                  <p className="text-[10px] text-stone-400">{r.resolvedAt ? fmt(r.resolvedAt) : ''}</p>
                </div>
                <span
                  className={`shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    r.status === 'approved'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {r.status === 'approved' ? 'Approved (অনুমোদিত)' : 'Rejected (বাতিল)'}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
