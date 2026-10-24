import React, { useState } from 'react';
import { getAdminEmail, changeAdminEmail, changeAdminPassword } from '../lib/auth';
import { dbExportAll, dbImportAll, dbWipeAll } from '../lib/localDb';
import PasswordConfirmModal from './PasswordConfirmModal';
import QrGenerateSection from './QrGenerateSection';
import { AttendancePolicy, AttendanceQRSet, AttendanceRecord } from '../types';
import { Shield, Mail, Lock, Save, AlertCircle, CheckCircle, Eye, EyeOff, Database, Download, Upload, Plus, Trash2, GraduationCap, CreditCard, Users } from 'lucide-react';

interface SettingsPageProps {
  academicClasses: string[];
  onUpdateAcademicClasses: (classes: string[]) => void;
  paymentMethods: string[];
  onUpdatePaymentMethods: (methods: string[]) => void;
  admins: string[];
  onUpdateAdmins: (admins: string[]) => void;
  attendanceQRSet: AttendanceQRSet | null;
  attendanceRecords: AttendanceRecord[];
  attendancePolicy: AttendancePolicy;
  onUpdateAttendancePolicy: (policy: AttendancePolicy) => void;
  onGenerateAttendanceQRSet: (startDate: string) => void;
  onDeleteAttendanceQRSet: () => void;
  onClearFeePayments: () => void;
  onClearLoanData: () => void;
  onClearAttendance: () => void;
  readOnly?: boolean;
}

export default function SettingsPage({ academicClasses, onUpdateAcademicClasses, paymentMethods, onUpdatePaymentMethods, admins, onUpdateAdmins, attendanceQRSet, attendanceRecords, attendancePolicy, onUpdateAttendancePolicy, onGenerateAttendanceQRSet, onDeleteAttendanceQRSet, onClearFeePayments, onClearLoanData, onClearAttendance, readOnly }: SettingsPageProps) {
  const currentEmail = getAdminEmail();
  const [email, setEmail] = useState(currentEmail);
  const [emailPassword, setEmailPassword] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [curPassword, setCurPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passMsg, setPassMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  const [showCurPass, setShowCurPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [newClassName, setNewClassName] = useState('');
  const [newPaymentMethod, setNewPaymentMethod] = useState('');

  // Current Admins management (password protected)
  const [newAdminName, setNewAdminName] = useState('');
  const [adminGuard, setAdminGuard] = useState<{ label: string; onConfirm: () => void } | null>(null);

  const handleAddAdmin = () => {
    const name = newAdminName.trim();
    if (!name) return;
    if (admins.includes(name)) { alert(`"${name}" is already an admin.`); return; }
    setAdminGuard({
      label: `Add new admin: ${name}`,
      onConfirm: () => { onUpdateAdmins([...admins, name]); setNewAdminName(''); },
    });
  };

  const handleDeleteAdmin = (name: string) => {
    setAdminGuard({
      label: `Remove admin: ${name}`,
      onConfirm: () => { onUpdateAdmins(admins.filter((a) => a !== name)); },
    });
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailMsg(null);

    if (!email.trim()) { setEmailMsg({ type: 'error', text: 'Email cannot be empty.' }); return; }
    if (!emailPassword) { setEmailMsg({ type: 'error', text: 'Enter your current password to change email.' }); return; }

    setEmailLoading(true);
    try {
      const ok = await changeAdminEmail(emailPassword, email.trim());
      if (ok) {
        setEmailMsg({ type: 'success', text: 'Email updated successfully!' });
        setEmailPassword('');
      } else {
        setEmailMsg({ type: 'error', text: 'Current password is incorrect.' });
      }
    } catch {
      setEmailMsg({ type: 'error', text: 'Failed to update email.' });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg(null);

    if (!curPassword) { setPassMsg({ type: 'error', text: 'Enter your current password.' }); return; }
    if (!newPassword) { setPassMsg({ type: 'error', text: 'Enter a new password.' }); return; }
    if (newPassword.length < 6) { setPassMsg({ type: 'error', text: 'New password must be at least 6 characters.' }); return; }
    if (newPassword !== confirmPassword) { setPassMsg({ type: 'error', text: 'Passwords do not match.' }); return; }

    setPassLoading(true);
    try {
      const ok = await changeAdminPassword(curPassword, newPassword);
      if (ok) {
        setPassMsg({ type: 'success', text: 'Password changed successfully!' });
        setCurPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setPassMsg({ type: 'error', text: 'Current password is incorrect.' });
      }
    } catch {
      setPassMsg({ type: 'error', text: 'Failed to change password.' });
    } finally {
      setPassLoading(false);
    }
  };

  const handleExportData = () => {
    const data = dbExportAll();
    // Session stays device-local; credentials are already in the db export when synced.
    try {
      const session = localStorage.getItem('samdani_admin_session');
      if (session) data['samdani_admin_session'] = JSON.parse(session);
    } catch { /* ignore */ }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `samdania-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportData = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          const dataObj: Record<string, any> = {};
          Object.entries(data).forEach(([key, value]) => {
            // Session stays in localStorage; credentials + all app data go to Supabase.
            if (key === 'samdani_admin_session') {
              localStorage.setItem(key, JSON.stringify(value));
            } else {
              dataObj[key] = value;
            }
          });
          dbImportAll(dataObj);
          // Mirror credentials into localStorage for offline confirm dialogs.
          if (dataObj['samdani_admin_credentials']) {
            try {
              localStorage.setItem(
                'samdani_admin_credentials',
                JSON.stringify(dataObj['samdani_admin_credentials'])
              );
            } catch { /* ignore */ }
          }
          alert('Data imported successfully! Please refresh the page to see changes.');
        } catch {
          alert('Invalid backup file.');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleWipeAll = () => {
    if (
      !window.confirm(
        'WIPE ALL DATA?\n\nThis permanently deletes EVERY record (students, teachers, fees, ledger, results, attendance, loans, salaries, settings) from this device and the cloud.\n\nThe app will reload empty (0 everywhere). This cannot be undone.'
      )
    ) {
      return;
    }
    dbWipeAll();
    // Reload BEFORE the persistence effects can re-upload the stale in-memory state.
    window.location.reload();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <Shield className="h-6 w-6 text-[#4a5d4e]" />
        <h2 className="text-xl font-bold text-[#2c332d]">Settings</h2>
      </div>

      {/* Change Email */}
      {!readOnly && (
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <Mail className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Change Email</h3>
        </div>
        <form onSubmit={handleChangeEmail} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">New Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Current Password</label>
            <div className="relative">
              <input
                type={showCurPass ? 'text' : 'password'}
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 pr-10 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]"
              />
              <button type="button" onClick={() => setShowCurPass(!showCurPass)} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer">
                {showCurPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {emailMsg && (
            <div className={`text-xs rounded-lg p-3 flex items-center gap-2 ${emailMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {emailMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{emailMsg.text}</span>
            </div>
          )}
          <button type="submit" disabled={emailLoading} className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-sm font-bold px-4 py-2 rounded-lg transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2">
            <Save className="h-4 w-4" />
            {emailLoading ? 'Saving...' : 'Update Email'}
          </button>
        </form>
      </div>
      )}

      {/* Academic Levels Management */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Academic Levels (المراحل الدراسية)</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500">Manage the class/grade levels available across the system. These appear in student registration, fee collection, and exam marks entry.</p>
          
          {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Class 6, Class 7, Alim..."
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newClassName.trim() && !academicClasses.includes(newClassName.trim())) {
                    onUpdateAcademicClasses([...academicClasses, newClassName.trim()]);
                    setNewClassName('');
                  }
                }
              }}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
            />
            <button
              onClick={() => {
                if (newClassName.trim() && !academicClasses.includes(newClassName.trim())) {
                  onUpdateAcademicClasses([...academicClasses, newClassName.trim()]);
                  setNewClassName('');
                }
              }}
              disabled={!newClassName.trim() || academicClasses.includes(newClassName.trim())}
              className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {academicClasses.map((cls) => (
              <div key={cls} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-[#2c332d]">{cls}</span>
                {!readOnly && (
                <button
                  onClick={() => {
                    if (confirm(`Remove "${cls}" from academic levels?`)) {
                      onUpdateAcademicClasses(academicClasses.filter(c => c !== cls));
                    }
                  }}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                )}
              </div>
            ))}
          </div>

          {academicClasses.length === 0 && (
            <p className="text-xs text-red-500 italic">No academic levels configured. Add at least one level.</p>
          )}
        </div>
      </div>

      {/* Payment Methods Management */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Payment Methods (وسائل الدفع)</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500">Define the payment methods available when disbursing salary to teachers. These appear in the salary disbursement form.</p>
          
          {!readOnly && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. Cash, bKash, Nagad, Bank Transfer..."
              value={newPaymentMethod}
              onChange={(e) => setNewPaymentMethod(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newPaymentMethod.trim() && !paymentMethods.includes(newPaymentMethod.trim())) {
                    onUpdatePaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                    setNewPaymentMethod('');
                  }
                }
              }}
              className="flex-1 bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
            />
            <button
              onClick={() => {
                if (newPaymentMethod.trim() && !paymentMethods.includes(newPaymentMethod.trim())) {
                  onUpdatePaymentMethods([...paymentMethods, newPaymentMethod.trim()]);
                  setNewPaymentMethod('');
                }
              }}
              disabled={!newPaymentMethod.trim() || paymentMethods.includes(newPaymentMethod.trim())}
              className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {paymentMethods.map((method) => (
              <div key={method} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-[#2c332d]">{method}</span>
                {!readOnly && (
                <button
                  onClick={() => {
                    if (confirm(`Remove "${method}" from payment methods?`)) {
                      onUpdatePaymentMethods(paymentMethods.filter(m => m !== method));
                    }
                  }}
                  className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all cursor-pointer"
                  title="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
                )}
              </div>
            ))}
          </div>

          {paymentMethods.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">No payment methods configured.</p>
                <p className="text-[10px] text-amber-500 mt-0.5">Add at least one method (e.g. Cash, bKash) so you can disburse salary to teachers.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Current Admins Management */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <Users className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Current Admins (বর্তমান অ্যাডমিন)</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500">Admins listed here appear as options in the "Received By" field when collecting fees. Adding or removing an admin requires the admin password.</p>

          {!readOnly && (
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Karim, Admin 2, Abdullah..."
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAdmin(); } }}
                className="flex-1 bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:border-[#4a5d4e]"
              />
              <button
                onClick={handleAddAdmin}
                disabled={!newAdminName.trim() || admins.includes(newAdminName.trim())}
                className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-xs font-bold px-3 py-2 rounded-lg transition-all cursor-pointer active:scale-95 flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {admins.map((a) => (
              <div key={a} className="flex items-center justify-between bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                <span className="text-xs font-bold text-[#2c332d]">{a}</span>
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteAdmin(a)}
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-all cursor-pointer"
                    title="Remove admin (requires password)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {admins.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-700">No admins configured.</p>
                <p className="text-[10px] text-amber-500 mt-0.5">Add at least one admin who can receive payments, otherwise the "Received By" field cannot be completed.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance QR Codes */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-5 space-y-2">
          <h3 className="text-sm font-bold text-[#2c332d]">Teacher Arrival Time (শিক্ষকের আগমনের সময়)</h3>
          <p className="text-xs text-stone-500">Arrivals before this time are marked early; after it they are marked late. Change this cutoff whenever the school schedule changes.</p>
          <label className="block max-w-xs text-xs font-semibold text-stone-600">
            Expected arrival
            <input
              type="time"
              value={attendancePolicy.expectedArrivalTime}
              onChange={(event) => onUpdateAttendancePolicy({ ...attendancePolicy, expectedArrivalTime: event.target.value })}
              className="mt-1 block w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono"
            />
          </label>
        </div>
      )}
      {!readOnly && (
        <QrGenerateSection
          qrSet={attendanceQRSet}
          attendance={attendanceRecords}
          onGenerate={onGenerateAttendanceQRSet}
          onDelete={onDeleteAttendanceQRSet}
        />
      )}

      {/* Change Password */}
      {!readOnly && (
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <Lock className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Change Password</h3>
        </div>
        <form onSubmit={handleChangePassword} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Current Password</label>
            <div className="relative">
              <input type={showCurPass ? 'text' : 'password'} value={curPassword} onChange={(e) => setCurPassword(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 pr-10 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
              <button type="button" onClick={() => setShowCurPass(!showCurPass)} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer">
                {showCurPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">New Password</label>
            <div className="relative">
              <input type={showNewPass ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 pr-10 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
              <button type="button" onClick={() => setShowNewPass(!showNewPass)} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer">
                {showNewPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">Confirm New Password</label>
            <div className="relative">
              <input type={showConfirmPass ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-lg text-sm px-3 py-2.5 pr-10 focus:outline-none focus:border-[#4a5d4e] focus:ring-1 focus:ring-[#4a5d4e]" />
              <button type="button" onClick={() => setShowConfirmPass(!showConfirmPass)} className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer">
                {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {passMsg && (
            <div className={`text-xs rounded-lg p-3 flex items-center gap-2 ${passMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
              {passMsg.type === 'success' ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{passMsg.text}</span>
            </div>
          )}
          <button type="submit" disabled={passLoading} className="bg-[#4a5d4e] hover:bg-[#3d4d41] disabled:bg-[#6a7d6e] text-white text-sm font-bold px-4 py-2 rounded-lg transition-all cursor-pointer active:scale-[0.98] flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {passLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
      )}

      {/* Targeted Data Reset — Danger Zone */}
      {!readOnly && (
      <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
        <div className="bg-red-50 px-5 py-3 border-b border-red-200 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <h3 className="text-sm font-bold text-red-700">Targeted Data Reset</h3>
          <span className="ml-auto text-[10px] font-bold uppercase bg-red-100 text-red-500 border border-red-200 px-2 py-0.5 rounded-full">Danger Zone</span>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-stone-500">
            These actions permanently delete the selected records from <strong>this device, localStorage, and Supabase cloud</strong>. All other connected devices will see zero immediately. This cannot be undone — export a backup first if needed.
          </p>

          {/* Clear Fee Payments */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="text-sm font-semibold text-red-700">Clear All Fee Payment Records</p>
              <p className="text-xs text-red-400">Wipes "Collected Fees (All Time)" and "Recent Fee Collections" → shows ৳0</p>
            </div>
            <button
              onClick={() => {
                if (window.confirm(
                  'DELETE ALL FEE PAYMENT RECORDS?\n\nThis will permanently remove every fee receipt from the database on ALL devices.\n\nStudent records and balances are NOT affected.\n\nThis cannot be undone.'
                )) {
                  onClearFeePayments();
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 ml-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Fees
            </button>
          </div>

          {/* Clear Loan Data */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="text-sm font-semibold text-red-700">Clear All Loan Records</p>
              <p className="text-xs text-red-400">Wipes all loan entries and repayment history → Loans module shows empty</p>
            </div>
            <button
              onClick={() => {
                if (window.confirm(
                  'DELETE ALL LOAN RECORDS?\n\nThis will permanently remove every loan entry and repayment from the database on ALL devices.\n\nThis cannot be undone.'
                )) {
                  onClearLoanData();
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 ml-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Loans
            </button>
          </div>

          {/* Clear Attendance Data */}
          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="text-sm font-semibold text-red-700">Clear All Attendance Records</p>
              <p className="text-xs text-red-400">Wipes all class and teacher attendance history → Attendance reports show empty/0</p>
            </div>
            <button
              onClick={() => {
                if (window.confirm(
                  'DELETE ALL ATTENDANCE RECORDS?\n\nThis will permanently remove every student class attendance and teacher attendance log from the database on ALL devices.\n\nThis cannot be undone.'
                )) {
                  onClearAttendance();
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shrink-0 ml-3"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear Attendance
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Backup & Restore (local) */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="bg-stone-50 px-5 py-3 border-b border-stone-200 flex items-center gap-2">
          <Database className="h-4 w-4 text-[#4a5d4e]" />
          <h3 className="text-sm font-bold text-[#2c332d]">Backup & Restore</h3>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-stone-500">All data is stored locally on this device. Use Export to keep a safe copy and Import to restore it later.</p>

          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
            <div>
              <p className="text-sm font-semibold text-[#2c332d]">Export All Data</p>
              <p className="text-xs text-stone-500">Download a JSON backup of all records</p>
            </div>
            <button onClick={handleExportData} disabled={readOnly} className="bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-stone-50 rounded-lg border border-stone-200">
            <div>
              <p className="text-sm font-semibold text-[#2c332d]">Import Data</p>
              <p className="text-xs text-stone-500">Restore from a previous backup file</p>
            </div>
            <button onClick={handleImportData} disabled={readOnly} className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Upload className="h-3.5 w-3.5" />
              Import
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="text-sm font-semibold text-red-700">Wipe All Data</p>
              <p className="text-xs text-red-500">Permanently delete every record — resets the app to zero</p>
            </div>
            <button onClick={handleWipeAll} disabled={readOnly} className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-3 py-1.5 rounded transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed">
              <Trash2 className="h-3.5 w-3.5" />
              Wipe
            </button>
          </div>
        </div>
      </div>

      {adminGuard && (
        <PasswordConfirmModal
          isOpen={true}
          onClose={() => setAdminGuard(null)}
          onConfirm={adminGuard.onConfirm}
          actionLabel={adminGuard.label}
        />
      )}
    </div>
  );
}
