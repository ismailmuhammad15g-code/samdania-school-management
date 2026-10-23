import React from 'react';
import logo2 from '../assets/images/logo2.png';
import { UserCog, Eye, ArrowLeft, ChevronRight } from 'lucide-react';

interface AdminRoleSelectProps {
  onSelectAdmin: () => void;
  onSelectViewer: () => void;
  onBack: () => void;
}

export default function AdminRoleSelect({ onSelectAdmin, onSelectViewer, onBack }: AdminRoleSelectProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 bg-gradient-to-br from-[#2c332d] via-[#3d4d41] to-[#4a5d4e] relative overflow-hidden">
      <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#d9c5b2]/10 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-[#d9c5b2]/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center">
        <div className="flex flex-col items-center text-center gap-3 mb-7 animate-[fadeIn_0.6s_ease]">
          <div className="p-3 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg">
            <img src={logo2} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow" />
          </div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-stone-100 tracking-tight">Continue as</h1>
          <p className="text-[11px] text-stone-300/80 font-light tracking-wide">অব্যাহত রাখুন · Choose your access level</p>
        </div>

        <div className="w-full bg-white/95 backdrop-blur rounded-2xl border border-white/30 shadow-2xl p-5 space-y-3 animate-[fadeIn_0.8s_ease]">
          <button
            onClick={onSelectAdmin}
            className="group w-full flex items-center justify-between gap-3 bg-[#4a5d4e] hover:bg-[#3d4d41] active:scale-[0.98] text-white rounded-xl px-4 py-3.5 shadow-sm border border-[#3d4d41] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-white/15">
                <UserCog className="h-5 w-5 text-[#d9c5b2]" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">Admin</span>
                <span className="block text-[10px] text-stone-200/80">পূর্ণ নিয়ন্ত্রণ · Full control</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-[#d9c5b2] group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={onSelectViewer}
            className="group w-full flex items-center justify-between gap-3 bg-white hover:bg-stone-50 active:scale-[0.98] text-[#2c332d] rounded-xl px-4 py-3.5 shadow-sm border border-stone-200 transition-all cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <span className="p-2 rounded-lg bg-[#4a5d4e]/10">
                <Eye className="h-5 w-5 text-[#4a5d4e]" />
              </span>
              <span className="text-left">
                <span className="block text-sm font-bold">Viewer Admin</span>
                <span className="block text-[10px] text-stone-400">শুধু দেখার অ্যাক্সেস · View only</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5 text-stone-300 group-hover:translate-x-0.5 transition-transform" />
          </button>

          <button
            onClick={onBack}
            className="w-full flex items-center justify-center gap-1.5 text-stone-500 hover:text-stone-700 text-xs font-bold py-2 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}
