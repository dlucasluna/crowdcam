import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  createSignalingChannel,
  sendSignal,
  type SignalMessage,
} from "@/lib/signaling";
import {
  createPeerConnection,
  createOffer,
  handleAnswer,
  handleIceCandidate,
} from "@/lib/webrtc";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Monitor } from "lucide-react";

export default function OutputPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, { pc: RTCPeerConnection; stream: MediaStream | null }>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputIdRef = useRef(`output-${Date.now()}`);

  const [selectedId, setSelectedId] = useState<string | null>(
    () => localStorage.getItem(`crowdcam-selected-${roomId}`)
  );
  const [selectedName, setSelectedName] = useState(
    () => localStorage.getItem(`crowdcam-selected-name-${roomId}`) || ""
  );
  const [showName, setShowName] = useState(false);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");

  // Listen for admin selection via localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === `crowdcam-selected-${roomId}`) {
        setSelectedId(e.newValue);
        const name = localStorage.getItem(`crowdcam-selected-name-${roomId}`);
        setSelectedName(name || "");
        if (e.newValue) {
          setShowName(false);
          setTimeout(() => setShowName(true), 300);
        } else {
          setShowName(false);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [roomId]);

  // Attach selected stream to video
  const attachSelected = useCallback(() => {
    if (!videoRef.current) return;
    if (!selectedId) {
      videoRef.current.srcObject = null;
      return;
    }
    const peer = peersRef.current.get(selectedId);
    if (peer?.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [selectedId]);

  useEffect(() => {
    attachSelected();
  }, [selectedId, attachSelected]);

  // Connect signaling
  useEffect(() => {
    if (!roomId) return;
    const outputId = outputIdRef.current;

    const channel = createSignalingChannel(roomId, outputId, async (msg: SignalMessage) => {
      if (msg.type === "join") {
        const cameraId = msg.from;
        const pc = createPeerConnection(channel, outputId, cameraId, (remoteStream) => {
          const peer = peersRef.current.get(cameraId);
          if (peer) {
            peer.stream = remoteStream;
            // If this is the selected camera, attach
            if (cameraId === selectedId || localStorage.getItem(`crowdcam-selected-${roomId}`) === cameraId) {
              if (videoRef.current) videoRef.current.srcObject = remoteStream;
            }
          }
        });
        peersRef.current.set(cameraId, { pc, stream: null });
        await createOffer(pc, channel, outputId, cameraId);
      } else if (msg.type === "answer") {
        const peer = peersRef.current.get(msg.from);
        if (peer) await handleAnswer(peer.pc, msg.payload);
      } else if (msg.type === "ice") {
        const peer = peersRef.current.get(msg.from);
        if (peer) await handleIceCandidate(peer.pc, msg.payload);
      } else if (msg.type === "leave") {
        const peer = peersRef.current.get(msg.from);
        if (peer) {
          peer.pc.close();
          peersRef.current.delete(msg.from);
        }
      } else if (msg.type === "select") {
        // Admin broadcast selection via Realtime (cross-browser)
        const newId = msg.payload?.selectedId || null;
        setSelectedId(newId);
        if (newId) {
          const name = msg.payload?.selectedName || "";
          setSelectedName(name);
          setShowName(false);
          setTimeout(() => setShowName(true), 300);
        } else {
          setShowName(false);
        }
      }
    });

    channelRef.current = channel;
    setStatus("connected");

    return () => {
      channel.unsubscribe();
      peersRef.current.forEach((p) => p.pc.close());
      peersRef.current.clear();
    };
  }, [roomId]);

  // Polling backup
  useEffect(() => {
    const interval = setInterval(() => {
      const stored = localStorage.getItem(`crowdcam-selected-${roomId}`);
      const storedName = localStorage.getItem(`crowdcam-selected-name-${roomId}`);
      if (stored !== selectedId) {
        setSelectedId(stored);
        setSelectedName(storedName || "");
        if (stored) {
          setShowName(false);
          setTimeout(() => setShowName(true), 300);
        } else {
          setShowName(false);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [roomId, selectedId]);

  // Show name on load if already selected
  useEffect(() => {
    if (selectedId && selectedName) {
      setTimeout(() => setShowName(true), 600);
    }
  }, []);

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {selectedId ? (
        <>
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />
          {/* Lower Third */}
          {selectedName && (
            <div
              className="absolute z-10 pointer-events-none"
              style={{
                bottom: 48,
                left: 48,
                transform: showName ? "translateX(0)" : "translateX(-120%)",
                opacity: showName ? 1 : 0,
                transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              <div className="flex items-stretch" style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.5))" }}>
                <div className="w-1 rounded-l" style={{ background: "hsl(var(--primary))" }} />
                <div className="px-6 py-3 rounded-r-lg" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}>
                  <div className="text-[22px] font-semibold text-white tracking-tight leading-tight">
                    {selectedName}
                  </div>
                  <div className="text-xs mt-0.5 font-normal tracking-widest uppercase" style={{ color: "rgba(255,255,255,0.5)" }}>
                    AO VIVO
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-muted-foreground text-sm text-center">
          <Monitor className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>A aguardar seleção no painel admin...</p>
          <p className="text-xs mt-2">
            Sala: {roomId} · {status === "connected" ? "Conectado" : status === "connecting" ? "Conectando..." : "Erro"}
          </p>
        </div>
      )}
    </div>
  );
}
