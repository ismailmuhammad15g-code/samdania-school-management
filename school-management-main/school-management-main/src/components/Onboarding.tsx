import React, { useState } from 'react';
import logo2 from '../assets/images/logo2.png';
import { GraduationCap, UserCog, Users, Loader2, ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onSelectTeacher: () => void;
  onSelectAdmin: () => void;
}

export default function Onboarding({ onSelectTeacher, onSelectAdmin }: OnboardingProps) {
  const [loadingRole, setLoadingRole] = useState<'teacher' | null>(null);

  const handleTeacher = () => {
    setLoadingRole('teacher');
    setTimeout(() => {
      setLoadingRole(null);
      onSelectTeacher();
    }, 850);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e] relative overflow-hidden">
      {/* decorative circles */}
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#d9c5b2]/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#d9c5b2]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        {/* Logo + Title */}
        <div className="flex flex-col items-center text-center gap-4 mb-9 animate-[fadeIn_0.6s_ease]">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
            <img
              src={logo2}
              alt="Samdania Madrasah Logo"
              className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow"
            />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-stone-100 tracking-tight leading-tight">
              Welcome to
            </h1>
            <h2 className="text-2xl sm:text-3xl font-serif font-extrabold text-[#d9c5b2] tracking-tight leading-tight mt-1">
              Samdania Madrasah
            </h2>
            <p className="text-[11px] sm:text-xs text-stone-300/80 mt-2 font-light tracking-wide">
              সামদানিয়া তালীমুল ইসলাম মাদ্রাসা
            </p>
          </div>
        </div>

        {/* Role selection */}
        <div className="w-full bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-2xl p-5 sm:p-6 space-y-3 animate-[fadeIn_0.8s_ease]">
          <p className="text-center text-[11px] font-bold uppercase tracking-widest text-stone-400 mb-1">
            Choose your portal
          </p>

          <button
            onClick={handleTeacher}
            disabled={loadingRole === 'teacher'}
            className="group w-full flex items-center justify-between gap-3 bg-[#4a5d4e] hover:bg-[#3d4d41] active:scale-[0.98] text-white rounded-xl px-4 py-3.5 shadow-sm border border-[#3d4d41] transition-all cursor-pointer disabled:opacity-70"
          >
            <span className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-white/15">
                <GraduationCap className="h-5 w-5 text-[#d9c5b2]" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">I am a Teacher</span>
                <span className="block text-[10px] text-stone-200/80">আমি একজন শিক্ষক</span>
              </span>
            </span>
            {loadingRole === 'teacher' ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#d9c5b2]" />
            ) : (
              <ChevronRight className="h-5 w-5 text-[#d9c5b2] group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>

          <button
            onClick={onSelectAdmin}
            className="group w-full flex items-center justify-between gap-3 bg-white hover:bg-stone-50 active:scale-[0.98] text-[#2c332d] rounded-xl px-4 py-3.5 shadow-sm border border-stone-200 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-[#4a5d4e]/10">
                <UserCog className="h-5 w-5 text-[#4a5d4e]" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">I am Admin</span>
                <span className="block text-[10px] text-stone-400">আমি অ্যাডমিন</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-stone-300 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            disabled
            title="Coming soon"
            className="w-full flex items-center justify-between gap-3 bg-stone-100 text-stone-400 rounded-xl px-4 py-3.5 border border-stone-200 cursor-not-allowed opacity-60"
          >
            <span className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-stone-200">
                <Users className="h-5 w-5 text-stone-400" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-semibold">I am Staff</span>
                <span className="block text-[10px] text-stone-400">আমি স্টাফ (প্রতিষ্ঠিত নয়)</span>
              </span>
            </span>
            <span className="text-[9px] font-bold uppercase bg-stone-200 text-stone-500 px-2 py-1 rounded-full">
              Soon
            </span>
          </button>
        </div>

        <p className="text-[10px] text-stone-300/60 mt-6 text-center">
          © {new Date().getFullYear()} Samdania Madrasah. All rights reserved.
        </p>
      </div>
    </div>
  );
}
