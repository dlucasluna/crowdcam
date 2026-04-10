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

type OutputPeer = {
  pc: RTCPeerConnection;
  stream: MediaStream | null;
};

export default function OutputPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, OutputPeer>>(new Map());
  const videoRef = useRef<HTMLVideoElement>(null);
  const outputIdRef = useRef(`output-${Date.now()}`);
  const nameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedIdRef = useRef<string | null>(
    localStorage.getItem(`crowdcam-selected-${roomId}`)
  );
  const selectedNameRef = useRef(
    localStorage.getItem(`crowdcam-selected-name-${roomId}`) || ""
  );

  const [selectedId, setSelectedId] = useState<string | null>(() => selectedIdRef.current);
  const [selectedName, setSelectedName] = useState(() => selectedNameRef.current);
  const [showName, setShowName] = useState(false);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");

  const clearNameTimeout = useCallback(() => {
    if (nameTimeoutRef.current) {
      clearTimeout(nameTimeoutRef.current);
      nameTimeoutRef.current = null;
    }
  }, []);

  const attachStreamToVideo = useCallback((stream: MediaStream | null) => {
    const video = videoRef.current;
    if (!video) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    if (stream) {
      video.play().catch(() => undefined);
    }
  }, []);

  const revealName = useCallback(
    (delay: number) => {
      clearNameTimeout();
      setShowName(false);

      if (!selectedNameRef.current) return;

      nameTimeoutRef.current = setTimeout(() => {
        setShowName(true);
      }, delay);
    },
    [clearNameTimeout]
  );

  const applySelection = useCallback(
    (newId: string | null, newName: string) => {
      const normalizedName = newId ? newName : "";
      const idChanged = selectedIdRef.current !== newId;
      const nameChanged = selectedNameRef.current !== normalizedName;

      if (!idChanged && !nameChanged) {
        if (newId) {
          const existingPeer = peersRef.current.get(newId);
          if (existingPeer?.stream) {
            attachStreamToVideo(existingPeer.stream);
          }
        }
        return;
      }

      selectedIdRef.current = newId;
      selectedNameRef.current = normalizedName;
      setSelectedId(newId);
      setSelectedName(normalizedName);

      if (!newId) {
        clearNameTimeout();
        setShowName(false);
        attachStreamToVideo(null);
        return;
      }

      const peer = peersRef.current.get(newId);
      if (peer?.stream) {
        attachStreamToVideo(peer.stream);
      }

      revealName(idChanged ? 300 : 150);
    },
    [attachStreamToVideo, clearNameTimeout, revealName]
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key !== `crowdcam-selected-${roomId}` &&
        e.key !== `crowdcam-selected-name-${roomId}`
      ) {
        return;
      }

      const nextId = localStorage.getItem(`crowdcam-selected-${roomId}`);
      const nextName = localStorage.getItem(`crowdcam-selected-name-${roomId}`) || "";
      applySelection(nextId, nextName);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [roomId, applySelection]);

  useEffect(() => {
    if (!selectedId) {
      attachStreamToVideo(null);
      return;
    }

    const peer = peersRef.current.get(selectedId);
    if (peer?.stream) {
      attachStreamToVideo(peer.stream);
    }
  }, [selectedId, attachStreamToVideo]);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const outputId = outputIdRef.current;

    const init = async () => {
      const channel = await createSignalingChannel(roomId, outputId, async (msg: SignalMessage) => {
        if (msg.type === "join") {
          const cameraId = msg.from;
          const existing = peersRef.current.get(cameraId);

          if (
            existing &&
            existing.pc.connectionState !== "failed" &&
            existing.pc.connectionState !== "closed"
          ) {
            return;
          }

          if (existing) existing.pc.close();

          const pc = createPeerConnection(channel, outputId, cameraId, (remoteStream) => {
            const peer = peersRef.current.get(cameraId);
            if (!peer) return;

            peer.stream = remoteStream;

            if (selectedIdRef.current === cameraId) {
              attachStreamToVideo(remoteStream);
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

          if (selectedIdRef.current === msg.from) {
            applySelection(null, "");
          }
        } else if (msg.type === "select") {
          const newId = msg.payload?.selectedId || null;
          const newName = msg.payload?.selectedName || "";
          applySelection(newId, newName);
        }
      });

      if (cancelled) {
        channel.unsubscribe();
        return;
      }

      channelRef.current = channel;
      setStatus("connected");

      // Ask all cameras to re-announce so this output discovers them instantly
      sendSignal(channel, {
        type: "request-join",
        from: outputId,
      });
    };

    init();

    return () => {
      cancelled = true;
      clearNameTimeout();
      attachStreamToVideo(null);
      channelRef.current?.unsubscribe();
      peersRef.current.forEach((p) => p.pc.close());
      peersRef.current.clear();
    };
  }, [roomId, applySelection, attachStreamToVideo, clearNameTimeout]);

  useEffect(() => {
    if (selectedIdRef.current && selectedNameRef.current) {
      revealName(600);
    }

    return () => {
      clearNameTimeout();
    };
  }, [clearNameTimeout, revealName]);

  return (
    <div className="h-screen w-screen bg-black flex items-center justify-center overflow-hidden relative">
      {selectedId ? (
        <>
          <video ref={videoRef} className="w-full h-full object-contain" autoPlay playsInline muted />
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
