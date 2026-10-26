import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ImagePlus, RefreshCw, ShieldCheck, Trash2, Upload, X } from 'lucide-react';
import { getAuthClient, hasWebsiteAdminAccess } from '../lib/auth';
import { getMainMadrasahApiUrl } from '../lib/sms';
import type { TeacherAccount } from '../types';
import MainMadrasahTeachers from './MainMadrasahTeachers';

type SiteContent = {
  academic_en: string;
  academic_bn: string;
  admission_en: string;
  admission_bn: string;
};

type GalleryImage = {
  name: string;
  url: string;
};

type AdmissionRequest = {
  id: string;
  student_name: string;
  student_age: number | null;
  guardian_name: string;
  contact: string;
  class_name: string;
  message: string;
  status: 'new' | 'reviewed' | 'contacted' | 'closed';
  created_at: string;
};

type ApiResponse = {
  message?: string;
  content?: Partial<SiteContent>;
  images?: GalleryImage[];
  admissions?: AdmissionRequest[];
  image?: GalleryImage;
};

const EMPTY_CONTENT: SiteContent = {
  academic_en: '',
  academic_bn: '',
  admission_en: '',
  admission_bn: '',
};

const STATUSES: AdmissionRequest['status'][] = ['new', 'reviewed', 'contacted', 'closed'];
const API_DEFAULT = getMainMadrasahApiUrl();
const SUPABASE_PROJECT_REF = import.meta.env.VITE_SUPABASE_URL?.match(/^https?:\/\/([^.]+)/i)?.[1] ?? 'unknown';

interface MainMadrasahPageProps {
  readOnly?: boolean;
  teacherAccounts: TeacherAccount[];
}

export default function MainMadrasahPage({ readOnly = false, teacherAccounts }: MainMadrasahPageProps) {
  const apiUrl = API_DEFAULT;
  const [supabase] = useState(() => getAuthClient());
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [admissions, setAdmissions] = useState<AdmissionRequest[]>([]);
  const [content, setContent] = useState<SiteContent>(EMPTY_CONTENT);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<'website' | 'teachers'>('website');
  const hasWebsiteAccess = hasWebsiteAdminAccess(session);
  const apiReadOnly = readOnly || !hasWebsiteAccess;

  const request = useCallback(async (path: string, init: RequestInit = {}): Promise<ApiResponse> => {
    const base = apiUrl.trim().replace(/\/+$/, '');
    if (!base) throw new Error('The official website API address is not configured.');
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!data.session?.access_token) {
      throw new Error('The software login does not include the Supabase Auth session required by the website admin API.');
    }

    let endpoint: URL;
    try {
      endpoint = new URL(`${base}${path}`);
    } catch {
      throw new Error('The website API address is invalid.');
    }
    if (endpoint.protocol !== 'https:' && endpoint.hostname !== 'localhost' && endpoint.hostname !== '127.0.0.1') {
      throw new Error('Use HTTPS for the public website address.');
    }

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${data.session.access_token}`);
    const response = await fetch(endpoint, { ...init, headers, cache: 'no-store' });
    const result = (await response.json()) as ApiResponse;
    if (!response.ok) throw new Error(result.message || `Website request failed (${response.status}).`);
    return result;
  }, [apiUrl, supabase]);

  const connect = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      const [gallery, applications, siteContent] = await Promise.all([
        request('/api/admin/gallery', { signal }),
        request('/api/admin/admissions', { signal }),
        request('/api/admin/content', { signal }),
      ]);
      setImages(gallery.images ?? []);
      setAdmissions(applications.admissions ?? []);
      setContent({ ...EMPTY_CONTENT, ...siteContent.content });
      setMessage('Connected to the public website.');
    } catch (cause) {
      if (signal?.aborted) return;
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Could not connect to the public website.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError(true);
        setMessage(sessionError.message);
      }

      let currentSession = data.session;
      if (currentSession && !hasWebsiteAdminAccess(currentSession)) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (!active) return;
        if (refreshError) {
          setError(true);
          setMessage(`Could not refresh the website admin session: ${refreshError.message}`);
        } else {
          currentSession = refreshedData.session;
        }
      }

      setSession(currentSession);
      setAuthReady(true);
    })().catch((cause: unknown) => {
      if (!active) return;
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Could not check the website admin session.');
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (authReady && session?.access_token && hasWebsiteAdminAccess(session)) {
      const controller = new AbortController();
      void connect(controller.signal);
      return () => controller.abort();
    }
    if (authReady && !hasWebsiteAdminAccess(session)) {
      setLoading(false);
      setImages([]);
      setAdmissions([]);
      setContent(EMPTY_CONTENT);
      setError(false);
      setMessage('');
    }
    return undefined;
  }, [authReady, connect, session]);

  const saveContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      await request('/api/admin/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      setMessage('Website information saved.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'Website information could not be saved.');
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile) {
      setError(true);
      setMessage('Choose an image before uploading.');
      return;
    }

    setLoading(true);
    setError(false);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', selectedFile);
      const result = await request('/api/admin/gallery', { method: 'POST', body: form });
      setSelectedFile(null);
      if (result.image) setImages((current) => [result.image!, ...current]);
      else await refreshGallery();
      setMessage('Gallery image uploaded.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'The gallery image could not be uploaded.');
    } finally {
      setLoading(false);
    }
  };

  const refreshGallery = async () => {
    const result = await request('/api/admin/gallery');
    setImages(result.images ?? []);
  };

  const updateAdmission = async (id: string, status: AdmissionRequest['status']) => {
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      await request('/api/admin/admissions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });
      setAdmissions((current) => current.map((item) => item.id === id ? { ...item, status } : item));
      setMessage('Admission request updated.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'The admission request could not be updated.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAdmission = async (id: string) => {
    if (!window.confirm('Delete this admission request? This cannot be undone.')) return;
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      await request('/api/admin/admissions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setAdmissions((current) => current.filter((item) => item.id !== id));
      setMessage('Admission request deleted.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'The admission request could not be deleted.');
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async (image: GalleryImage) => {
    if (!window.confirm('Remove this image from the public gallery?')) return;
    setLoading(true);
    setError(false);
    setMessage('');
    try {
      await request('/api/admin/gallery', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: image.name }),
      });
      setImages((current) => current.filter((item) => item.name !== image.name));
      setMessage('Gallery image removed.');
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : 'The gallery image could not be removed.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const setContentField = (key: keyof SiteContent, value: string) => {
    setContent((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 sm:p-7">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Main Madrasah</h2>
            <p className="mt-1 text-sm text-stone-500">
              Manage the public website gallery, verified website information, and admission requests.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 p-4">
          <div>
            <p className="text-sm font-semibold text-stone-800">Software administrator session</p>
            <p className="mt-1 text-xs text-stone-500">
              {authReady ? `Website API: ${apiUrl}` : 'Checking website access…'}
            </p>
          </div>
          <p className="text-sm text-stone-600">
            {authReady
              ? hasWebsiteAccess
                ? 'Website data access is connected.'
                : 'Website data access needs one-time setup.'
              : 'Checking website data access…'}
          </p>
        </div>
        {readOnly && <p className="mt-3 text-sm font-medium text-amber-700">View-only access: changes are disabled.</p>}
        {!hasWebsiteAccess && authReady && (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">
            {!session
              ? `No Supabase website-admin session is active. Log out of the school software, sign back in with the configured administrator credentials, and reopen this page.`
              : `The refreshed session for Supabase project ${SUPABASE_PROJECT_REF} still does not include the website admin claim. Confirm the claim is true for the signed-in Auth user in this project, then log out of the school software and sign back in.`}
          </p>
        )}
        {message && (
          <p className={`mt-4 rounded-lg px-3 py-2 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'}`} role="status">
            {message}
          </p>
        )}
      </div>

      <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Main Madrasah sections">
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'website'}
              onClick={() => setActiveSection('website')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${activeSection === 'website' ? 'bg-emerald-900 text-white' : 'border border-stone-300 bg-white text-stone-700'}`}
            >
              Website, gallery & admissions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeSection === 'teachers'}
              onClick={() => setActiveSection('teachers')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${activeSection === 'teachers' ? 'bg-emerald-900 text-white' : 'border border-stone-300 bg-white text-stone-700'}`}
            >
              Teachers — আমাদের সম্পর্কে
            </button>
          </div>

          {activeSection === 'website' && (
            <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-50 p-3 text-amber-800"><ImagePlus className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-stone-900">Website information</h3>
                <p className="mt-1 text-xs text-stone-500">Only add verified school information. Empty fields are not shown publicly.</p>
              </div>
            </div>
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={saveContent}>
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">
                Academic information — English
                <textarea
                  className="min-h-32 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
                  maxLength={4000}
                  value={content.academic_en}
                  onChange={(event) => setContentField('academic_en', event.target.value)}
                  disabled={apiReadOnly || loading}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">
                Academic information — বাংলা
                <textarea
                  className="min-h-32 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
                  maxLength={4000}
                  value={content.academic_bn}
                  onChange={(event) => setContentField('academic_bn', event.target.value)}
                  disabled={apiReadOnly || loading}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">
                Admission information — English
                <textarea
                  className="min-h-32 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
                  maxLength={4000}
                  value={content.admission_en}
                  onChange={(event) => setContentField('admission_en', event.target.value)}
                  disabled={apiReadOnly || loading}
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-stone-700">
                Admission information — বাংলা
                <textarea
                  className="min-h-32 rounded-lg border border-stone-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-emerald-700"
                  maxLength={4000}
                  value={content.admission_bn}
                  onChange={(event) => setContentField('admission_bn', event.target.value)}
                  disabled={apiReadOnly || loading}
                />
              </label>
              <button
                type="submit"
                disabled={loading || apiReadOnly}
                className="inline-flex min-h-10 w-fit items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" /> : null}
                Save website information
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-50 p-3 text-emerald-800"><ImagePlus className="h-5 w-5" /></div>
                <div>
                  <h3 className="font-bold text-stone-900">Gallery management</h3>
                  <p className="mt-1 text-xs text-stone-500">Upload PNG, JPEG, or WebP images up to 8 MB.</p>
                </div>
              </div>
              <button
                type="button"
                disabled={loading || apiReadOnly}
                onClick={() => void refreshGallery().catch((cause: unknown) => {
                  setError(true);
                  setMessage(cause instanceof Error ? cause.message : 'Gallery could not be refreshed.');
                })}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 disabled:opacity-50"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>
            <form onSubmit={uploadImage} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFile}
                disabled={apiReadOnly || loading}
                className="block w-full text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-stone-700"
              />
              <button
                type="submit"
                disabled={loading || apiReadOnly || !selectedFile}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-4 w-4" /> Upload image
              </button>
            </form>
            {images.length === 0 ? (
              <p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-stone-500">No uploaded gallery images.</p>
            ) : (
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {images.map((image) => (
                  <div key={image.name} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
                    <img
                      src={image.url}
                      alt="Madrasah gallery"
                      loading="lazy"
                      className="h-full w-full object-cover"
                      onError={(event) => { event.currentTarget.style.opacity = '0.35'; }}
                    />
                    <button
                      type="button"
                      disabled={loading || apiReadOnly}
                      onClick={() => void deleteImage(image)}
                      aria-label="Remove image"
                      className="absolute right-2 top-2 rounded-full bg-white/90 p-2 text-red-700 shadow transition hover:bg-white disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-sky-50 p-3 text-sky-800"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h3 className="font-bold text-stone-900">Admission requests</h3>
                <p className="mt-1 text-xs text-stone-500">Applicant details are visible only in this management page.</p>
              </div>
            </div>
            {admissions.length === 0 ? (
              <p className="mt-5 rounded-lg bg-stone-50 p-4 text-sm text-stone-500">No admission requests.</p>
            ) : (
              <div className="mt-5 space-y-3">
                {admissions.map((application) => (
                  <article key={application.id} className="rounded-xl border border-stone-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-stone-900">{application.student_name}</h4>
                        <p className="mt-1 text-xs text-stone-600">
                          {application.guardian_name} · {application.contact} · {application.class_name}
                          {application.student_age !== null && ` · ${application.student_age} years old`}
                        </p>
                        {application.message && <p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{application.message}</p>}
                        <p className="mt-2 text-[11px] text-stone-400">
                          {new Date(application.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={application.status}
                          disabled={loading || apiReadOnly}
                          onChange={(event) => void updateAdmission(application.id, event.target.value as AdmissionRequest['status'])}
                          className="rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs disabled:opacity-50"
                          aria-label={`Status for ${application.student_name}`}
                        >
                          {STATUSES.map((status) => <option value={status} key={status}>{status}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => void deleteAdmission(application.id)}
                          disabled={loading || apiReadOnly}
                          aria-label={`Delete request for ${application.student_name}`}
                          className="rounded-lg border border-red-200 p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
            </div>
          )}

          {activeSection === 'teachers' && (
            <MainMadrasahTeachers apiUrl={apiUrl} readOnly={apiReadOnly} teacherAccounts={teacherAccounts} />
          )}
      </>
    </div>
  );
}
