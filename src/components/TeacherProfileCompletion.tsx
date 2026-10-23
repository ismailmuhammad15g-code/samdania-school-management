import React, { useState } from 'react';
import { Camera, Loader2, X, UserCheck } from 'lucide-react';
import { TeacherAccount } from '../types';
import { uploadStudentPhoto } from '../lib/imgbb';

// Downscale a captured selfie to a small JPEG data URL so it can be stored
// directly in the app's own database (no external image host, no network
// dependency, no "forbidden" errors). A selfie only needs to be tiny.
function resizeToDataUrl(dataUrl: string, maxDim = 480, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width === 0 || height === 0) {
        reject(new Error('Could not read the photo. Please retake.'));
        return;
      }
      if (width > height && width > maxDim) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else if (height > maxDim) {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl); // fallback: keep original if canvas unavailable
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Could not read the photo. Please retake.'));
    img.src = dataUrl;
  });
}

interface TeacherProfileCompletionProps {
  account: TeacherAccount;
  onComplete: (id: string, patch: Partial<TeacherAccount>) => void;
  onLater?: () => void;
}

const ROLE_OPTIONS = ['Teacher', 'Staff', 'Hifz Muallim', 'Quran Teacher', 'Admin'];

export default function TeacherProfileCompletion({ account, onComplete, onLater }: TeacherProfileCompletionProps) {
  const [profPhoto, setProfPhoto] = useState<string | null>(null);
  const [profPhotoLink, setProfPhotoLink] = useState(account.photoUrl || '');
  const [profFile, setProfFile] = useState<File | null>(null);
  const [profRole, setProfRole] = useState(account.role || account.designation || 'Teacher');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setProfFile(file);
    const reader = new FileReader();
    reader.onload = () => setProfPhoto(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleComplete = async () => {
    if (!profPhoto && !profPhotoLink.trim()) {
      setError('Please choose a photo or enter an image link.');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const url = profPhotoLink.trim() || (profFile ? await uploadStudentPhoto(profFile) : await resizeToDataUrl(profPhoto!));
      onComplete(account.id, { photoUrl: url, role: profRole, designation: profRole });
    } catch (err: any) {
      setError(err && err.message ? err.message : 'Photo could not be processed. Please retake and try again.');
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-stone-200 overflow-hidden">
        <div className="bg-[#4a5d4e] text-stone-100 px-5 py-4 flex items-center justify-between">
          <h3 className="text-sm font-serif font-bold flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Complete Your Profile (প্রোফাইল সম্পূর্ণ করুন)
          </h3>
          {onLater && (
            <button onClick={onLater} className="text-stone-200/80 hover:text-white cursor-pointer" title="Later">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[11px] text-stone-500 leading-relaxed">
            Please attach a clear selfie (taken with your camera) and select your role so your profile is complete.
            আপনার একটি স্পষ্ট সেলফি (ক্যামেরা দিয়ে তোলা) এবং ভূমিকা নির্বাচন করুন।
          </p>

          {/* Camera-only selfie capture */}
          <div>
            <label className="block text-[10px] font-bold text-stone-500 mb-1">Selfie Photo (সেলফি ছবি)</label>
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-stone-100 border border-stone-200 overflow-hidden flex items-center justify-center shrink-0">
                {profPhoto ? (
                  <img src={profPhoto} alt="Selfie preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-6 w-6 text-stone-400" />
                )}
              </div>
              <label className="flex-1 cursor-pointer bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 border border-[#3d4d41] flex items-center justify-center gap-1.5">
                <Camera className="h-4 w-4 text-[#d9c5b2]" />
                {profPhoto ? 'Retake (আবার তুলুন)' : 'Capture (ক্যামেরা)'}
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={handleCapture}
                  className="hidden"
                />
              </label>
            </div>
            <input aria-label="Teacher profile image link" type="url" value={profPhotoLink} onChange={(e) => setProfPhotoLink(e.target.value)} className="mt-2 w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-3 py-2" />
            <p className="text-[10px] text-stone-400 mt-1">Camera only — gallery/device picker is disabled.</p>
          </div>

          {/* Role */}
          <div>
            <label className="block text-[10px] font-bold text-stone-500 mb-1">Role (ভূমিকা)</label>
            <select
              value={profRole}
              onChange={(e) => setProfRole(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-lg text-xs px-2.5 py-2.5 focus:outline-none focus:border-[#4a5d4e]"
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-[11px] text-red-600 font-semibold">{error}</p>
          )}

          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-blue-600 font-bold text-xs py-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading… (আপলোড হচ্ছে…)
            </div>
          ) : (
            <button
              onClick={handleComplete}
              className="w-full bg-[#4a5d4e] hover:bg-[#3d4d41] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm active:scale-95 cursor-pointer border border-[#3d4d41] flex items-center justify-center gap-1.5"
            >
              <UserCheck className="h-4 w-4 text-[#d9c5b2]" />
              Save & Complete (সংরক্ষণ ও সম্পূর্ণ)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
