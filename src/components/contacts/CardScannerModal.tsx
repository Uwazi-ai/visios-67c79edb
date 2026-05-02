import { useEffect, useRef, useState } from "react";
import { X, Camera, Upload, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ScannedCard {
  name: string | null;
  title: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  linkedin: string | null;
  address: string | null;
  notes: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onExtracted: (card: ScannedCard) => void;
}

type Stage = "camera" | "processing" | "error";

export const CardScannerModal = ({ open, onClose, onExtracted }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("camera");
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStage("camera");
    setError(null);
    setCameraReady(false);

    let active = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("Camera not available on this device. Use Upload instead.");
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!active) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => setCameraReady(true);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not access camera");
      }
    })();

    return () => {
      active = false;
    };
  }, [open]);

  // Cleanup stream when modal closes
  useEffect(() => {
    if (!open && stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [open, stream]);

  const stopStream = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  };

  const processImage = async (dataUrl: string) => {
    setStage("processing");
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke("scan-business-card", {
        body: { image: dataUrl },
      });
      if (invokeErr) throw invokeErr;
      const card = (data as { data?: ScannedCard })?.data;
      if (!card) throw new Error("No data returned");
      stopStream();
      onExtracted(card);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Scan failed";
      setError(msg);
      setStage("error");
      toast.error(`Scan failed: ${msg}`);
    }
  };

  const capture = () => {
    if (!videoRef.current || !cameraReady) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    // JPEG @ 0.85 keeps payload small for the AI gateway
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    processImage(dataUrl);
  };

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (dataUrl) processImage(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    stopStream();
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }}
    >
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10 safe-pt">
        <div className="t-mono text-white" style={{ fontSize: 11 }}>
          {stage === "camera" && "Position card within frame"}
          {stage === "processing" && "Extracting contact info…"}
          {stage === "error" && "Scan failed"}
        </div>
        <button onClick={handleClose} className="btn-icon" style={{ background: "rgba(255,255,255,0.08)" }} aria-label="Close">
          <X size={16} color="#fff" />
        </button>
      </div>

      {/* Camera view */}
      {stage === "camera" && (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover", maxHeight: "100vh" }}
          />
          {/* Card framing overlay */}
          {!error && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                style={{
                  width: "min(90vw, 480px)",
                  aspectRatio: "1.6 / 1",
                  border: "2px dashed rgba(255,255,255,0.6)",
                  borderRadius: 16,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                }}
              />
            </div>
          )}

          {/* Bottom controls */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 p-4 safe-pb z-10">
            {error && (
              <div
                className="glass-elevated px-3 py-2 flex items-center gap-2"
                style={{ color: "var(--sev-warning)", fontSize: 12 }}
              >
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost"
                style={{ background: "rgba(255,255,255,0.08)", color: "#fff", borderColor: "rgba(255,255,255,0.12)" }}
              >
                <Upload size={14} /> Upload
              </button>
              <button
                onClick={capture}
                disabled={!cameraReady || !!error}
                style={{
                  width: 72, height: 72, borderRadius: "50%",
                  background: "#fff", border: "4px solid rgba(255,255,255,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: cameraReady ? "pointer" : "not-allowed",
                  opacity: cameraReady && !error ? 1 : 0.5,
                  boxShadow: "0 8px 28px rgba(0,0,0,0.5)",
                }}
                aria-label="Capture"
              >
                <Camera size={26} color="#02020A" />
              </button>
              <div style={{ width: 76 }} />
            </div>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={onUpload} style={{ display: "none" }} />
        </>
      )}

      {stage === "processing" && (
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="animate-spin" color="#fff" />
          <div style={{ color: "#fff", fontSize: 14, fontWeight: 500 }}>Extracting contact info…</div>
          <div className="t-mono" style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>
            AI vision · usually 3–6 seconds
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <AlertCircle size={32} color="var(--sev-warning)" />
          <div style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Couldn't read that card</div>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, maxWidth: 320 }}>
            {error || "Try better lighting and a clear, focused shot."}
          </div>
          <div className="flex gap-2">
            <button onClick={() => { setStage("camera"); setError(null); }} className="btn-primary">
              <RotateCcw size={12} /> Try again
            </button>
            <button onClick={handleClose} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};
