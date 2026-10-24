import { useEffect, useState } from 'react';
import { Download, ExternalLink, QrCode, Smartphone } from 'lucide-react';
import { toDataURL as qrToDataURL } from 'qrcode';

const APP_DOWNLOAD_URL = 'https://samdaniamadrasha.vercel.app/app';
const WEBSITE_URL = 'https://samdaniamadrasha.vercel.app/';

export default function AppDownloadQrPage() {
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      qrToDataURL(APP_DOWNLOAD_URL, {
        width: 720,
        margin: 3,
        color: { dark: '#153e30', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }),
      qrToDataURL(WEBSITE_URL, {
        width: 720,
        margin: 3,
        color: { dark: '#153e30', light: '#ffffff' },
        errorCorrectionLevel: 'H',
      }),
    ])
      .then(([appQr, websiteQr]) => {
        if (!cancelled) setQrDataUrls({ app: appQr, website: websiteQr });
      })
      .catch(() => {
        if (!cancelled) setError('The QR code could not be generated. Please reload this page.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mx-auto max-w-5xl">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e2a20] via-[#294232] to-[#49634f] p-6 text-white shadow-xl sm:p-10">
        <div className="mx-auto max-w-3xl text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
            <Smartphone className="h-7 w-7 text-[#e4d0a0]" />
          </span>
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-[#e4d0a0]">Official Madrasah App</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-4xl">Scan to download the app</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/75 sm:text-base">
            Scan this QR code with a phone camera to open the official Samdania Talimul Islam Madrasah app download page.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-3xl items-center gap-7 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm sm:grid-cols-[minmax(0,1fr)_minmax(230px,280px)] sm:p-7">
          <div className="min-w-0 text-center sm:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100/20 bg-emerald-100/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
              <QrCode className="h-4 w-4" />
              App download QR
            </div>
            <h2 className="mt-4 text-xl font-bold sm:text-2xl">Share the app easily</h2>
            <p className="mt-2 text-sm leading-6 text-white/70">
              The QR code opens the Madrasah’s app page, where users can read about the app and download the Android APK.
            </p>
            <p className="mt-5 break-all rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/90">
              {APP_DOWNLOAD_URL}
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
              <a
                href={APP_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e3cf9d] px-5 text-sm font-bold text-[#1e2a20] transition hover:bg-white"
              >
                <ExternalLink className="h-4 w-4" />
                Open app page
              </a>
              {qrDataUrls.app && (
                <a
                  href={qrDataUrls.app}
                  download="samdania-madrasah-app-qr.png"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/20"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </a>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[280px] rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
            <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
              {qrDataUrls.app ? (
                <img
                  src={qrDataUrls.app}
                  alt={`QR code linking to ${APP_DOWNLOAD_URL}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm text-stone-500" role={error ? 'alert' : 'status'}>
                  {error ? <p>{error}</p> : <><QrCode className="h-8 w-8 animate-pulse text-emerald-800" /><p>Preparing QR code…</p></>}
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-xs font-bold text-stone-700">SAMDANIA MADRASAH APP</p>
          </div>
        </div>

          <div className="mx-auto mt-8 max-w-3xl border-t border-white/15 pt-8">
            <div className="text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10">
                <ExternalLink className="h-6 w-6 text-[#e4d0a0]" />
              </span>
              <h2 className="mt-4 text-xl font-black sm:text-2xl">Scan to visit the official website</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/70">
                Scan this QR code to open the Samdania Talimul Islam Madrasah official website.
              </p>
            </div>

            <div className="mt-6 grid items-center gap-6 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm sm:grid-cols-[minmax(0,1fr)_minmax(230px,280px)] sm:p-7">
              <div className="min-w-0 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-100/20 bg-emerald-100/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
                  <QrCode className="h-4 w-4" />
                  Official website QR
                </div>
                <h3 className="mt-4 text-xl font-bold sm:text-2xl">Share the Madrasah website</h3>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Visitors can scan the code to explore the school, admission information, gallery, and app download page.
                </p>
                <p className="mt-5 break-all rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm text-white/90">
                  {WEBSITE_URL}
                </p>
                <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row sm:justify-start">
                  <a
                    href={WEBSITE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#e3cf9d] px-5 text-sm font-bold text-[#1e2a20] transition hover:bg-white"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open official website
                  </a>
                  {qrDataUrls.website && (
                    <a
                      href={qrDataUrls.website}
                      download="samdania-madrasah-website-qr.png"
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/20"
                    >
                      <Download className="h-4 w-4" />
                      Download QR
                    </a>
                  )}
                </div>
              </div>

              <div className="mx-auto w-full max-w-[280px] rounded-3xl bg-white p-4 shadow-2xl sm:p-5">
                <div className="relative aspect-square overflow-hidden rounded-2xl bg-stone-100">
                  {qrDataUrls.website ? (
                    <img
                      src={qrDataUrls.website}
                      alt={`QR code linking to ${WEBSITE_URL}`}
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-3 p-5 text-center text-sm text-stone-500" role={error ? 'alert' : 'status'}>
                      {error ? <p>{error}</p> : <><QrCode className="h-8 w-8 animate-pulse text-emerald-800" /><p>Preparing QR code…</p></>}
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-xs font-bold text-stone-700">OFFICIAL MADRASAH WEBSITE</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-white/55">
            Ensure your phone camera can scan QR codes. Internet access is needed to open the app page.
          </p>
      </div>
    </section>
  );
}
