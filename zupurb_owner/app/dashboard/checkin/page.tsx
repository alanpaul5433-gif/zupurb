'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';
import jsQR from 'jsqr';

type ScanState =
  | 'idle'
  | 'scanning'
  | 'detected'
  | 'looking_up'
  | 'found'
  | 'not_found'
  | 'checking_in'
  | 'success';

interface ReservationInfo {
  id: string;
  guestName: string;
  partySize: number;
  scheduledAt: string;
  status: string;
}

export default function CheckInPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [reservation, setReservation] = useState<ReservationInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const resetToScanning = useCallback(() => {
    setReservation(null);
    setErrorMsg('');
    setScanState('scanning');
  }, []);

  const lookUpReservation = useCallback(async (reservationId: string) => {
    setScanState('looking_up');
    try {
      const resDoc = await getDoc(doc(db, 'reservations', reservationId));
      if (!resDoc.exists()) {
        setScanState('not_found');
        setErrorMsg('Reservation not found. QR code may be invalid.');
        return;
      }
      const data = resDoc.data();
      const scheduledAt = data.scheduledAt?.seconds
        ? new Date(data.scheduledAt.seconds * 1000).toLocaleString()
        : 'Unknown time';
      setReservation({
        id: reservationId,
        guestName: data.guestName ?? data.userId ?? 'Unknown Guest',
        partySize: data.partySize ?? 1,
        scheduledAt,
        status: data.status ?? 'unknown',
      });
      setScanState('found');
    } catch {
      setScanState('not_found');
      setErrorMsg('Error looking up reservation. Please try again.');
    }
  }, []);

  const startCamera = useCallback(async () => {
    setScanState('scanning');
    setErrorMsg('');
    setReservation(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      let scanning = true;
      intervalRef.current = setInterval(() => {
        if (!scanning) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code && code.data) {
          scanning = false;
          setScanState('detected');
          lookUpReservation(code.data);
        }
      }, 500);
    } catch {
      setScanState('idle');
      setErrorMsg('Camera access denied. Please allow camera permissions and try again.');
    }
  }, [lookUpReservation]);

  const handleCheckIn = async () => {
    if (!reservation) return;
    setScanState('checking_in');
    try {
      const markReservation = httpsCallable(getFunctions(app, 'us-central1'), 'markReservation');
      await markReservation({ reservationId: reservation.id, status: 'seated' });
      setScanState('success');
      setTimeout(() => {
        resetToScanning();
      }, 3000);
    } catch {
      setErrorMsg('Failed to check in. Please try again.');
      setScanState('found');
    }
  };

  const handleStop = useCallback(() => {
    stopCamera();
    setScanState('idle');
    setReservation(null);
    setErrorMsg('');
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const statusLabel: Record<ScanState, string> = {
    idle: '',
    scanning: 'Scanning...',
    detected: 'QR Detected!',
    looking_up: 'Looking up reservation...',
    found: 'Reservation found',
    not_found: 'Reservation not found',
    checking_in: 'Checking in...',
    success: 'Checked in!',
  };

  const isCameraActive = ['scanning', 'detected', 'looking_up', 'found', 'checking_in', 'success'].includes(scanState);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">QR Check-In</h1>
        <p className="text-sm text-gray-500 mt-1">Scan a guest&apos;s reservation QR code to check them in</p>
      </div>

      {/* Camera area */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-5">
        <div className="relative bg-black rounded-t-xl overflow-hidden" style={{ minHeight: 320 }}>
          <video
            ref={videoRef}
            className="w-full object-cover"
            style={{ display: isCameraActive ? 'block' : 'none', maxHeight: 400 }}
            muted
            playsInline
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning line overlay */}
          {scanState === 'scanning' && (
            <div className="absolute inset-0 pointer-events-none">
              <div
                className="absolute left-0 right-0 h-0.5 opacity-80"
                style={{
                  backgroundColor: '#BF5B2E',
                  animation: 'scanLine 2s ease-in-out infinite',
                }}
              />
              {/* Corner guides */}
              <div className="absolute inset-8">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br" />
              </div>
            </div>
          )}

          {/* Success overlay */}
          {scanState === 'success' && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-600/90">
              <div className="text-center">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-4xl">✓</span>
                </div>
                <p className="text-white text-xl font-bold">Checked In!</p>
                <p className="text-green-100 text-sm mt-1">Resetting in 3 seconds…</p>
              </div>
            </div>
          )}

          {!isCameraActive && (
            <div className="flex items-center justify-center bg-gray-900" style={{ minHeight: 320 }}>
              <div className="text-center text-gray-400">
                <span className="text-6xl block mb-3">🔲</span>
                <p className="text-sm">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCameraActive && scanState !== 'success' && scanState !== 'not_found' && (
              <div
                className="w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: scanState === 'found' ? '#10B981' : '#BF5B2E' }}
              />
            )}
            <p className="text-sm font-medium text-gray-700">
              {statusLabel[scanState] || 'Camera off'}
            </p>
          </div>
          {isCameraActive ? (
            <button
              onClick={handleStop}
              className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Stop Camera
            </button>
          ) : (
            <button
              onClick={startCamera}
              className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors"
              style={{ backgroundColor: '#BF5B2E' }}
            >
              Start Camera
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-5 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Reservation card */}
      {reservation && (scanState === 'found' || scanState === 'checking_in') && (
        <div className="bg-white rounded-xl border-2 border-green-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
              👤
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{reservation.guestName}</p>
              <p className="text-xs text-gray-500 capitalize">Status: {reservation.status}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Party Size</p>
              <p className="font-semibold text-gray-900">👥 {reservation.partySize}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-0.5">Scheduled</p>
              <p className="font-semibold text-gray-900 text-sm">{reservation.scheduledAt}</p>
            </div>
          </div>
          <button
            onClick={handleCheckIn}
            disabled={scanState === 'checking_in'}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-bold rounded-lg transition-colors text-sm"
          >
            {scanState === 'checking_in' ? 'Checking In…' : 'Check In Guest'}
          </button>
        </div>
      )}

      {/* CSS for scan line animation */}
      <style>{`
        @keyframes scanLine {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }
      `}</style>
    </div>
  );
}
