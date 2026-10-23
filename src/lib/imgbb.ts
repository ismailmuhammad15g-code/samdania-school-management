const IMGBB_ENDPOINT = 'https://api.imgbb.com/1/upload';
const IMGBB_API_KEY = 'b6e7f704bd9db049251beab63469cebb';

export async function uploadStudentPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append('key', IMGBB_API_KEY);
  body.append('image', file);

  const response = await fetch(IMGBB_ENDPOINT, { method: 'POST', body });
  const result = await response.json() as { success?: boolean; data?: { display_url?: string; url?: string }; error?: { message?: string } };
  const url = result.data?.display_url || result.data?.url;
  if (!response.ok || !result.success || !url) {
    throw new Error(result.error?.message || 'Photo upload failed.');
  }
  return url;
}
