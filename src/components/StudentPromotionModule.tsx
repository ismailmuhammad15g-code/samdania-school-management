import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Download, GraduationCap, Users } from 'lucide-react';
import type { Student, StudentEnrollmentHistory } from '../types';
import { isStudentActive, makeStudentPromotionBackup, type PromotionOutcome } from '../lib/studentEnrollment';

interface StudentPromotionModuleProps {
  students: Student[];
  academicClasses: string[];
  backupData: Record<string, unknown>;
  onPromote: (students: Student[]) => void;
  readOnly?: boolean;
}

type Decision = { outcome: PromotionOutcome | ''; transferBranch: string };

function defaultTargetClass(sourceClass: string, classes: string[]): string {
  if (sourceClass === 'Play' || sourceClass === 'Nursery') {
    return classes.find((name) => /^class\s*1$/i.test(name)) || sourceClass;
  }
  const match = sourceClass.match(/^class\s*(\d+)$/i);
  if (match) return classes.find((name) => name.toLowerCase() === `class ${Number(match[1]) + 1}`) || sourceClass;
  return sourceClass;
}

export default function StudentPromotionModule({ students, academicClasses, backupData, onPromote, readOnly }: StudentPromotionModuleProps) {
  const thisYear = new Date().getFullYear();
  const [currentSession, setCurrentSession] = useState(thisYear);
  const [classFilter, setClassFilter] = useState('All Classes');
  const [rollMode, setRollMode] = useState<'preserve' | 'reset'>('preserve');
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [targetClasses, setTargetClasses] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nextSession = currentSession + 1;
  const classes = academicClasses.filter(Boolean);

  const cohort = useMemo(
    () => students.filter((student) => (student.academicSession ?? currentSession) === currentSession && isStudentActive(student)),
    [students, currentSession],
  );
  const visibleStudents = cohort.filter((student) => classFilter === 'All Classes' || student.class === classFilter);
  const sourceClasses = Array.from(new Set(cohort.map((student) => student.class))).sort((a, b) => a.localeCompare(b));
  const resolvedTargetClass = (student: Student) => targetClasses[student.class] || defaultTargetClass(student.class, classes);
  const decisionFor = (student: Student): Decision => decisions[student.id] || { outcome: '', transferBranch: '' };
  const assignedCount = cohort.filter((student) => Boolean(decisionFor(student).outcome)).length;

  const setVisibleOutcome = (outcome: PromotionOutcome) => {
    setDecisions((previous) => {
      const next = { ...previous };
      visibleStudents.forEach((student) => {
        next[student.id] = { ...decisionFor(student), outcome };
      });
      return next;
    });
    setError('');
  };

  const handlePromote = () => {
    setError('');
    if (readOnly || saving) return;
    if (cohort.length === 0) {
      setError(`No active students were found in session ${currentSession}.`);
      return;
    }
    const unreviewed = cohort.filter((student) => !decisionFor(student).outcome);
    if (unreviewed.length) {
      setError(`Review every student in the session before applying changes. ${unreviewed.length} student(s) still need an outcome.`);
      return;
    }
    const invalidTransfer = cohort.find((student) =>
      decisionFor(student).outcome === 'transfer' && !decisionFor(student).transferBranch.trim(),
    );
    if (invalidTransfer) {
      setError(`Enter the destination branch for ${invalidTransfer.name}.`);
      return;
    }

    const confirmText = `Apply ${cohort.length} student decision(s) from session ${currentSession} to ${nextSession}? A backup JSON file will download first. This cannot be undone automatically.`;
    if (!window.confirm(confirmText)) return;

    setSaving(true);
    try {
      makeStudentPromotionBackup(students, currentSession, backupData);
      const timestamp = new Date().toISOString();
      const cohortIds = new Set(cohort.map((student) => student.id));
      let updated = students.map((student) => {
        if (!cohortIds.has(student.id)) return student;
        const decision = decisionFor(student);
        const outcome = decision.outcome as PromotionOutcome;
        const nextClass = outcome === 'promote' ? resolvedTargetClass(student) : student.class;
        const history: StudentEnrollmentHistory[] = [
          ...(student.enrollmentHistory || []),
          ...(!student.enrollmentHistory?.length
            ? [{
                session: currentSession,
                className: student.class,
                outcome: 'admitted' as const,
                recordedAt: timestamp,
              }]
            : []),
          {
            session: nextSession,
            className: nextClass,
            outcome: outcome === 'promote' ? 'promoted' : outcome === 'retain' ? 'retained' : outcome === 'left' ? 'left' : 'transferred',
            recordedAt: timestamp,
            ...(outcome === 'transfer' ? { branch: decision.transferBranch.trim() } : {}),
          },
        ];
        return {
          ...student,
          class: nextClass,
          academicSession: nextSession,
          enrollmentStatus: outcome === 'left' ? 'left' as const : outcome === 'transfer' ? 'transferred' as const : 'active' as const,
          transferBranch: outcome === 'transfer' ? decision.transferBranch.trim() : undefined,
          enrollmentHistory: history,
        };
      });

      if (rollMode === 'reset') {
        const rollTargets = new Map<string, Student[]>();
        for (const student of updated) {
          const outcome = cohortIds.has(student.id) ? decisionFor(student).outcome : '';
          if (!cohortIds.has(student.id) || outcome === 'left') continue;
          const group = rollTargets.get(student.class) || [];
          group.push(student);
          rollTargets.set(student.class, group);
        }
        const newRolls = new Map<string, string>();
        for (const group of rollTargets.values()) {
          group.sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true, sensitivity: 'base' }) || a.name.localeCompare(b.name));
          group.forEach((student, index) => newRolls.set(student.id, String(index + 1)));
        }
        updated = updated.map((student) => newRolls.has(student.id) ? { ...student, roll: newRolls.get(student.id)! } : student);
      }

      onPromote(updated);
      setDecisions({});
      setError('');
    } catch (promotionError) {
      setError(promotionError instanceof Error ? promotionError.message : 'Promotion could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <header className="rounded-2xl bg-gradient-to-r from-[#1e2a20] to-[#4a5d4e] p-5 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7 text-[#d9c5b2]" />
          <div>
            <h1 className="text-lg font-bold">Student Promotion (ক্লাস প্রমোশন)</h1>
            <p className="text-xs text-white/75 mt-1">Review each student, then apply the session transition in one batch.</p>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-bold text-stone-600">
            Current academic session
            <input type="number" min="2000" max="2200" value={currentSession} onChange={(event) => setCurrentSession(Number(event.target.value) || thisYear)} className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2" />
          </label>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-bold text-emerald-700">Next session</p>
            <p className="mt-1 text-sm font-black text-emerald-900">{nextSession}</p>
          </div>
          <label className="text-xs font-bold text-stone-600">
            Roll numbers
            <select value={rollMode} onChange={(event) => setRollMode(event.target.value as 'preserve' | 'reset')} className="mt-1 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
              <option value="preserve">Keep existing rolls</option>
              <option value="reset">Reset sequentially per class</option>
            </select>
          </label>
        </div>
        <div className="grid gap-3">
          <h2 className="text-xs font-bold text-stone-700">Class mapping (ক্লাস ম্যাপিং)</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sourceClasses.map((source) => (
              <label key={source} className="flex items-center gap-2 rounded-lg border border-stone-100 bg-stone-50 p-2 text-xs">
                <span className="min-w-0 flex-1 truncate font-semibold">{source}</span>
                <span aria-hidden="true">→</span>
                <select value={targetClasses[source] || defaultTargetClass(source, classes)} onChange={(event) => setTargetClasses((previous) => ({ ...previous, [source]: event.target.value }))} className="max-w-36 rounded-md border border-stone-200 bg-white px-2 py-1">
                  {classes.map((className) => <option key={className} value={className}>{className}</option>)}
                </select>
              </label>
            ))}
            {!sourceClasses.length && <p className="text-xs text-stone-500">No classes in this session.</p>}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-[#2c332d]"><Users className="h-4 w-4 text-[#4a5d4e]" />Session {currentSession} · {cohort.length} active students</div>
            <div className="text-xs font-semibold text-stone-500">Reviewed: {assignedCount}/{cohort.length}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)} className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs">
              <option>All Classes</option>
              {sourceClasses.map((className) => <option key={className}>{className}</option>)}
            </select>
            {!readOnly && (['promote', 'retain', 'left', 'transfer'] as PromotionOutcome[]).map((outcome) => (
              <button key={outcome} type="button" onClick={() => setVisibleOutcome(outcome)} className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-[10px] font-bold text-stone-600 hover:bg-stone-100">
                Set visible: {outcome}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-[#4a5d4e] text-white">
              <tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Roll</th><th className="px-3 py-3">Current class</th><th className="px-3 py-3">Decision</th><th className="px-3 py-3">Destination</th><th className="px-3 py-3">Transfer branch</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleStudents.map((student) => {
                const decision = decisionFor(student);
                const destination = decision.outcome === 'promote' ? resolvedTargetClass(student) : decision.outcome === 'retain' ? student.class : '—';
                return (
                  <tr key={student.id} className="hover:bg-stone-50">
                    <td className="px-3 py-2.5"><span className="font-bold text-[#2c332d]">{student.name}</span><span className="block text-[10px] text-stone-400">{student.id}</span></td>
                    <td className="px-3 py-2.5 font-mono">{student.roll}</td>
                    <td className="px-3 py-2.5">{student.class}</td>
                    <td className="px-3 py-2.5">
                      <select disabled={readOnly} value={decision.outcome} onChange={(event) => setDecisions((previous) => ({ ...previous, [student.id]: { ...decision, outcome: event.target.value as PromotionOutcome | '' } }))} className="rounded-md border border-stone-200 bg-white px-2 py-1.5">
                        <option value="">Choose…</option><option value="promote">Promote (পাস)</option><option value="retain">Retain (একই ক্লাস)</option><option value="left">Left / Dropout</option><option value="transfer">Transfer</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 font-semibold">{destination}</td>
                    <td className="px-3 py-2.5">
                      {decision.outcome === 'transfer' ? <input disabled={readOnly} value={decision.transferBranch} onChange={(event) => setDecisions((previous) => ({ ...previous, [student.id]: { ...decision, transferBranch: event.target.value } }))} placeholder="Branch name" className="w-40 rounded-md border border-stone-200 px-2 py-1.5" /> : '—'}
                    </td>
                  </tr>
                );
              })}
              {!visibleStudents.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-stone-500">No active students match this session and class.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
      <div className="flex flex-col-reverse items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
        <p className="flex items-start gap-2 text-[11px] text-amber-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />A complete JSON backup downloads before the batch. One confirmed batch updates session, class, status, roll choice, and each student's enrollment history while preserving the student ID and fee/payment history.</p>
        {!readOnly && <button type="button" onClick={handlePromote} disabled={saving || cohort.length === 0} className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[#4a5d4e] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
          {saving ? <Download className="h-4 w-4 animate-pulse" /> : <CheckCircle2 className="h-4 w-4" />}
          Apply reviewed transitions
        </button>}
      </div>
      {readOnly && <p className="text-xs font-semibold text-amber-700">Viewer mode: promotion changes are disabled.</p>}
    </div>
  );
}
