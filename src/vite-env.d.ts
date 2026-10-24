/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_EMAIL?: string;
  readonly VITE_ADMIN_PASSWORD?: string;
  readonly VITE_AUTH_SALT?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_MAIN_MADRASAH_API_URL?: string;
  readonly VITE_GROQ_API_KEY?: string;
  readonly VITE_GROQ_BASE_URL?: string;
  readonly VITE_GROQ_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'qrcode' {
  export function toDataURL(text: string, options?: any): Promise<string>;
  export function toCanvas(canvas: HTMLCanvasElement | string, text: string, options?: any): Promise<void>;
  export function toString(text: string, options?: any): Promise<string>;
  const QRCode: any;
  export default QRCode;
}

declare module 'jsqr' {
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }
  ): {
    data: string;
    location: { topLeftCorner: { x: number; y: number }; topRightCorner: { x: number; y: number }; bottomLeftCorner: { x: number; y: number }; bottomRightCorner: { x: number; y: number }; topLeftFinderPattern: any; topRightFinderPattern: any; bottomLeftFinderPattern: any; bottomRightAlignmentPattern: any };
    binaryData: number[];
    chunks: any[];
    version: number;
    content: string;
  } | null;
}
