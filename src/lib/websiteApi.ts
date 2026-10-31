// Origin of the public website's Next.js admin API (gallery, admissions, content, teachers).
// SMS does not use it — see sms.ts.
export function getMainMadrasahApiUrl(): string {
  const configuredUrl = import.meta.env.VITE_MAIN_MADRASAH_API_URL?.trim();
  if (configuredUrl) {
    try {
      const parsedUrl = new URL(configuredUrl);
      const hostname = parsedUrl.hostname.replace(/^\[|\]$/g, '').toLowerCase();
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' ||
        hostname === '::1' || hostname.endsWith('.localhost');
      if (import.meta.env.PROD && (isLocalHost || parsedUrl.protocol !== 'https:')) return '';
    } catch {
      return '';
    }
    return configuredUrl;
  }
  return import.meta.env.DEV ? 'http://localhost:3018' : '';
}
