import React, { useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { ArrowLeft, Camera, Loader2, Lock, Mail, User, UserPlus, LogIn, Phone, BriefcaseBusiness, FileText } from 'lucide-react';
import type { StaffAccount, StaffPortalSession } from '../types';
import { createStaffPortalSession } from '../lib/staffSessions';
import { uploadStudentPhoto } from '../lib/imgbb';

interface StaffAuthProps {
  accounts: StaffAccount[];
  onCreateAccount: (account: StaffAccount) => void;
  onLogin: (session: StaffPortalSession) => void;
  onBack: () => void;
}

export default function StaffAuth({ accounts, onCreateAccount, onLogin, onBack }: StaffAuthProps) {
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const normalizedEmail = email.trim().toLowerCase();
    if (mode === 'login') {
      const match = accounts.find((account) => account.email.toLowerCase() === normalizedEmail && account.password === password);
      if (!match) {
        setError('Invalid email or password. Please try again. (ইমেইল অথবা পাসওয়ার্ড সঠিক নয়)');
        return;
      }
      onLogin(createStaffPortalSession(match));
      return;
    }

    if (!fullName.trim() || !role.trim()) {
      setError('Full name and profession are required. (নাম ও পেশা আবশ্যক)');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Enter a valid email address. (সঠিক ইমেইল লিখুন)');
      return;
    }
    if (accounts.some((account) => account.email.toLowerCase() === normalizedEmail)) {
      setError('This email already has a staff account. (এই ইমেইলে স্টাফ অ্যাকাউন্ট আছে)');
      return;
    }
    if (password.length < 4) {
      setError('Password must be at least 4 characters. (পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে)');
      return;
    }

    setBusy(true);
    try {
      const uploadedPhoto = photoFile ? await uploadStudentPhoto(photoFile) : '';
      const account: StaffAccount = {
        id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `STAFF-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        fullName: fullName.trim(),
        role: role.trim(),
        email: normalizedEmail,
        password,
        phone: phone.trim(),
        bio: bio.trim(),
        contactInfo: contactInfo.trim(),
        photoUrl: uploadedPhoto || photoUrl.trim() || undefined,
        createdAt: new Date().toISOString(),
        status: 'pending',
      };
      onCreateAccount(account);
      onLogin(createStaffPortalSession(account));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Photo upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-8 bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e]">
      <div className="w-full max-w-md">
        <button onClick={onBack} className="flex items-center gap-1.5 text-stone-200/80 hover:text-white text-xs mb-4">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex flex-col items-center text-center gap-2 mb-5">
          <img src={logo2} alt="Samdania Madrasah Logo" className="w-16 h-16 object-contain" />
          <h1 className="text-xl font-serif font-bold text-stone-100">Staff Portal (স্টাফ পোর্টাল)</h1>
        </div>
        <div className="flex bg-white/10 rounded-xl p-1 mb-4 border border-white/20">
          <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold ${mode === 'login' ? 'bg-[#4a5d4e] text-white' : 'text-stone-200'}`}>
            <LogIn className="h-4 w-4" /> Login (লগইন)
          </button>
          <button onClick={() => { setMode('create'); setError(''); }} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-bold ${mode === 'create' ? 'bg-[#4a5d4e] text-white' : 'text-stone-200'}`}>
            <UserPlus className="h-4 w-4" /> Create Account (অ্যাকাউন্ট)
          </button>
        </div>
        <form onSubmit={submit} className="bg-white rounded-2xl border border-stone-200 shadow-2xl p-5 space-y-3">
          {error && <p role="alert" className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{error}</p>}
          {mode === 'create' && <>
            <label className="block text-[11px] font-bold text-stone-700">Full Name (পুরো নাম)
              <span className="relative block mt-1"><User className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input required value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
            </label>
            <label className="block text-[11px] font-bold text-stone-700">Profession / Role (পেশা)
              <span className="relative block mt-1"><BriefcaseBusiness className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input required value={role} onChange={(e) => setRole(e.target.value)} placeholder="Driver, cleaner, office staff..." className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
            </label>
          </>}
          <label className="block text-[11px] font-bold text-stone-700">Email (ইমেইল)
            <span className="relative block mt-1"><Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input required type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
          </label>
          <label className="block text-[11px] font-bold text-stone-700">Password (পাসওয়ার্ড)
            <span className="relative block mt-1"><Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input required type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
          </label>
          {mode === 'create' && <>
            <label className="block text-[11px] font-bold text-stone-700">Phone (ফোন নম্বর)
              <span className="relative block mt-1"><Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
            </label>
            <label className="block text-[11px] font-bold text-stone-700">Profile Picture (প্রোফাইল ছবি) — optional (ঐচ্ছিক)
              <span className="relative block mt-1"><Camera className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><input type="url" value={photoUrl} onChange={(e) => { setPhotoUrl(e.target.value); setPhotoFile(null); }} placeholder="Image link (ছবির লিংক)" className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
              <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} className="mt-2 block w-full text-xs text-stone-600" />
              {photoFile && <span className="block mt-1 text-[10px] text-emerald-700">{photoFile.name}</span>}
            </label>
            <label className="block text-[11px] font-bold text-stone-700">Bio (পরিচিতি)
              <span className="relative block mt-1"><FileText className="absolute left-2.5 top-2.5 h-4 w-4 text-stone-400" /><textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="w-full bg-stone-50 border border-stone-200 rounded-lg pl-9 pr-3 py-2.5 text-sm" /></span>
            </label>
            <label className="block text-[11px] font-bold text-stone-700">Other Contact Information (অন্যান্য যোগাযোগের তথ্য)
              <textarea value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} rows={2} className="mt-1 w-full bg-stone-50 border border-stone-200 rounded-lg px-3 py-2.5 text-sm" />
            </label>
          </>}
          <button type="submit" disabled={busy} className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-sm font-bold py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-70">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
            {busy ? 'Creating account...' : mode === 'login' ? 'Login (লগইন)' : 'Create Staff Account (স্টাফ অ্যাকাউন্ট তৈরি)'}
          </button>
        </form>
      </div>
    </div>
  );
}
