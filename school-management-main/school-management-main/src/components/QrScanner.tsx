import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { X, Camera, ScanLine, AlertTriangle } from 'lucide-react';

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(image: HTMLCanvasElement | HTMLVideoElement | ImageBitmap | ImageData): Promise<Array<{ rawValue?: string }>>;
    };
  }
}

interface QrScannerProps {
  onResult: (raw: string) => void;
  onClose: () => void;
}

export default function QrScanner({ onResult, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<number | null>(null);
  const scanningRef = useRef(true);
  const lastScanRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(true);
  const [statusText, setStatusText] = useState('Align the QR code within the frame to mark attendance');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera API is not available on this device/browser.');
          return;
        }

        const preferred = {
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(preferred);
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;

        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.setAttribute('autoplay', 'true');
        video.muted = true;
        await video.play();

        setScanning(true);
        scanningRef.current = true;
        setStatusText('Scanning… keep the QR steady and well lit');
        intervalRef.current = window.setInterval(() => {
          void detectCurrentFrame();
        }, 250);
      } catch (e: any) {
        setError(
          e && e.name === 'NotAllowedError'
            ? 'Camera permission was denied. Please allow access and try again.'
            : 'The camera could not be started. Please try again or switch to another browser.'
        );
      }
    }

    async function detectCurrentFrame() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || !scanningRef.current) return;
      if (!video.videoWidth || !video.videoHeight) return;

      const sourceW = video.videoWidth;
      const sourceH = video.videoHeight;
      const cropSize = Math.min(sourceW, sourceH);
      const sx = (sourceW - cropSize) / 2;
      const sy = (sourceH - cropSize) / 2;

      canvas.width = 640;
      canvas.height = 640;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, 640, 640);
      ctx.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 640, 640);
      const imageData = ctx.getImageData(0, 0, 640, 640);

      const detected = await tryDetect(canvas, imageData);
      if (detected) {
        if (lastScanRef.current !== detected) {
          lastScanRef.current = detected;
          setStatusText('QR detected — processing attendance');
          setScanning(false);
          scanningRef.current = false;
          stopCamera();
          onResult(detected);
        }
      }
    }

    function tryDetect(canvas: HTMLCanvasElement, imageData: ImageData): Promise<string | null> {
      return (async () => {
        const DetectorCtor = window.BarcodeDetector;
        if (DetectorCtor) {
          try {
            const instance = new DetectorCtor();
            const results = await instance.detect(canvas);
            const value = results.find((item) => item.rawValue?.trim())?.rawValue?.trim();
            if (value) return value;
          } catch {
            // fall back to jsQR
          }
        }

        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        return code?.data ?? null;
      })();
    }

    start();

    return () => {
      cancelled = true;
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopCamera() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#2c332d] rounded-2xl shadow-2xl overflow-hidden border border-[#3d4d41]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-serif font-bold text-stone-100 flex items-center gap-2">
            <ScanLine className="h-4 w-4 text-[#d9c5b2]" />
            Scan Attendance QR (স্ক্যান করুন)
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition-all text-stone-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: '1 / 1' }}>
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="text-xs text-stone-200 leading-relaxed">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 bg-white/10 hover:bg-white/20 text-stone-100 text-xs font-bold px-4 py-2 rounded-lg border border-white/20 cursor-pointer transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-cover"
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />

              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-6 left-6 w-10 h-10 border-t-4 border-l-4 border-[#d9c5b2] rounded-tl-lg" />
                <div className="absolute top-6 right-6 w-10 h-10 border-t-4 border-r-4 border-[#d9c5b2] rounded-tr-lg" />
                <div className="absolute bottom-6 left-6 w-10 h-10 border-b-4 border-l-4 border-[#d9c5b2] rounded-bl-lg" />
                <div className="absolute bottom-6 right-6 w-10 h-10 border-b-4 border-r-4 border-[#d9c5b2] rounded-br-lg" />

                {scanning && (
                  <div className="absolute left-6 right-6 h-0.5 bg-[#d9c5b2] shadow-[0_0_12px_3px_rgba(217,197,178,0.7)]">
                    <div
                      className="w-full h-full"
                      style={{ animation: 'qrLaser 2s ease-in-out infinite' }}
                    />
                  </div>
                )}
                <style>{`
                  @keyframes qrLaser {
                    0%   { transform: translateY(0); opacity: 0; }
                    10%  { opacity: 1; }
                    50%  { transform: translateY(260px); opacity: 1; }
                    90%  { opacity: 1; }
                    100% { transform: translateY(0); opacity: 0; }
                  }
                `}</style>
              </div>
            </>
          )}
        </div>

        <div className="px-4 py-3 bg-[#2c332d] border-t border-white/10 flex items-center justify-center gap-2">
          <Camera className="h-4 w-4 text-[#d9c5b2]" />
          <p className="text-[11px] text-stone-300 font-medium">{statusText}</p>
        </div>
      </div>
    </div>
  );
}
