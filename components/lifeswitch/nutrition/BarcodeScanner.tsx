"use client";

import * as React from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

type BarcodeScannerProps = {
  open: boolean;
  onDetected: (code: string) => void;
  onClose: () => void;
};

export default function BarcodeScanner({ open, onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const controlsRef = React.useRef<IScannerControls | null>(null);
  const detectedRef = React.useRef(false);

  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) {
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore cleanup errors
      }
      controlsRef.current = null;
      detectedRef.current = false;
      setStatus("");
      setError("");
      return;
    }

    let cancelled = false;

    async function startScanner() {
      setError("");
      setStatus("Starting camera…");
      detectedRef.current = false;

      if (!videoRef.current) {
        setError("Scanner video element is not ready.");
        return;
      }

      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setError("Camera access is not available in this browser.");
        setStatus("");
        return;
      }

      try {
        const hints = new Map();
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
        ]);
        hints.set(DecodeHintType.TRY_HARDER, true);

        const reader = new BrowserMultiFormatReader(hints);

        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: false,
          },
          videoRef.current,
          (result) => {
            if (!result || detectedRef.current || cancelled) return;

            const code = result.getText()?.replace(/\D+/g, "").trim();
            if (!code || code.length < 8 || code.length > 14) return;

            detectedRef.current = true;
            setStatus(`Detected ${code}`);

            try {
              controlsRef.current?.stop();
            } catch {
              // ignore cleanup errors
            }

            onDetected(code);
            onClose();
          }
        );

        if (cancelled) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("Camera ready — scanning product barcode.");
      } catch (e) {
        setStatus("");
        setError(String(e instanceof Error ? e.message : e));
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore cleanup errors
      }
      controlsRef.current = null;
    };
  }, [open, onDetected, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Scan barcode</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Keep the product barcode centered, well lit, and fill about half the box. Move slowly closer or farther away if it does not scan. The code stays on this device; only the detected UPC is used.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border px-3 py-1.5 text-xs hover:bg-muted/30"
          >
            Close
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full object-cover"
            muted
            playsInline
            autoPlay
          />
        </div>

        {status ? <div className="mt-3 text-xs text-muted-foreground">{status}</div> : null}

        {error ? (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
            {error}
          </div>
        ) : null}

        <div className="mt-4 text-xs text-muted-foreground">
          If the camera does not work, close this and enter the UPC manually.
        </div>
      </div>
    </div>
  );
}
