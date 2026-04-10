import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  type PeerInfo,
} from "@/lib/webrtc";
import { getCameraLink } from "@/lib/room-utils";
import QRModal from "@/components/QRModal";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Camera, QrCode, Maximize2, Copy, Check, LogOut, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function AdminPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, PeerInfo>>(new Map());
  const adminIdRef = useRef(`admin-${Date.now()}`);

  const [participants, setParticipants] = useState<PeerInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "error">("connecting");
  const [showQR, setShowQR] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState(false);
  const [showNameOnOutput, setShowNameOnOutput] = useState(true);

  const updateParticipantsList = useCallback(() => {
    setParticipants(Array.from(peersRef.current.values()));
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const adminId = adminIdRef.current;

    const init = async () => {
      const channel = await createSignalingChannel(roomId, adminId, async (msg: SignalMessage) => {
        if (msg.type === "join") {
          const cameraId = msg.from;
          const cameraName = msg.payload?.name || cameraId;
          const existing = peersRef.current.get(cameraId);
          if (existing && existing.pc.connectionState !== "failed" && existing.pc.connectionState !== "closed") {
            existing.name = cameraName;
            updateParticipantsList();
            return;
          }
          if (existing) existing.pc.close();

          const pc = createPeerConnection(channel, adminId, cameraId, (remoteStream) => {
            const peer = peersRef.current.get(cameraId);
            if (peer) { peer.stream = remoteStream; updateParticipantsList(); }
          });

          peersRef.current.set(cameraId, { id: cameraId, name: cameraName, pc, stream: null });
          updateParticipantsList();
          await createOffer(pc, channel, adminId, cameraId);
        } else if (msg.type === "answer") {
          const pc = peersRef.current.get(msg.from)?.pc;
          if (pc) await handleAnswer(pc, msg.payload);
        } else if (msg.type === "ice") {
          const pc = peersRef.current.get(msg.from)?.pc;
          if (pc) await handleIceCandidate(pc, msg.payload);
        } else if (msg.type === "leave") {
          const peer = peersRef.current.get(msg.from);
          if (peer) {
            peer.pc.close();
            peersRef.current.delete(msg.from);
            updateParticipantsList();
            setSelectedId((prev) => (prev === msg.from ? null : prev));
          }
        }
      });

      if (cancelled) { channel.unsubscribe(); return; }
      channelRef.current = channel;
      setStatus("connected");
    };

    init();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      peersRef.current.forEach((p) => p.pc.close());
      peersRef.current.clear();
    };
  }, [roomId, updateParticipantsList]);

  // Sync selection to localStorage for Output page
  useEffect(() => {
    if (!roomId) return;
    if (selectedId) {
      localStorage.setItem(`crowdcam-selected-${roomId}`, selectedId);
      const peer = peersRef.current.get(selectedId);
      if (peer) localStorage.setItem(`crowdcam-selected-name-${roomId}`, peer.name);
    } else {
      localStorage.removeItem(`crowdcam-selected-${roomId}`);
      localStorage.removeItem(`crowdcam-selected-name-${roomId}`);
    }
    window.dispatchEvent(new StorageEvent("storage", { key: `crowdcam-selected-${roomId}`, newValue: selectedId }));
  }, [selectedId, roomId]);

  // Broadcast selection
  const lastBroadcastedRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (status !== "connected" || !channelRef.current || !roomId) return;
    if (lastBroadcastedRef.current === selectedId) return;
    lastBroadcastedRef.current = selectedId;

    const peer = selectedId ? peersRef.current.get(selectedId) : null;
    sendSignal(channelRef.current, {
      type: "select",
      from: adminIdRef.current,
      payload: { selectedId, selectedName: peer?.name || "" },
    });
  }, [status, selectedId, roomId]);

  // Broadcast show-name toggle
  const lastShowNameRef = useRef<boolean | undefined>(undefined);
  useEffect(() => {
    if (status !== "connected" || !channelRef.current) return;
    if (lastShowNameRef.current === showNameOnOutput) return;
    lastShowNameRef.current = showNameOnOutput;

    sendSignal(channelRef.current, {
      type: "show-name",
      from: adminIdRef.current,
      payload: { visible: showNameOnOutput },
    });
  }, [status, showNameOnOutput]);

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleLeaveRoom = () => {
    channelRef.current?.unsubscribe();
    peersRef.current.forEach((p) => p.pc.close());
    peersRef.current.clear();
    navigate("/dashboard");
  };

  const openOutput = () => {
    window.open(`/output/${roomId}`, "_blank", "width=1920,height=1080");
  };

  const copyOutputLink = () => {
    const link = `${window.location.origin}/output/${roomId}`;
    navigator.clipboard.writeText(link).then(() => {
      setCopiedOutput(true);
      toast.success("Link do output copiado!");
      setTimeout(() => setCopiedOutput(false), 2000);
    });
  };

  const cameraLink = getCameraLink(roomId || "");

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-secondary flex-shrink-0 flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xl font-semibold">
            <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span>CrowdCam</span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium font-mono tracking-wider"
            style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--primary))" }}>
            {roomId}
          </span>
          {status === "connected" && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "hsl(var(--success-soft))", color: "hsl(var(--success))" }}>
              Conectado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--primary))" }}>
            <Camera className="w-3.5 h-3.5" />
            {participants.length} câmera{participants.length !== 1 ? "s" : ""}
          </span>
          <button
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] font-medium transition-colors ${showNameOnOutput ? "border-primary/40 text-primary bg-primary/10" : "border-border-light text-muted-foreground hover:bg-card"}`}
            onClick={() => setShowNameOnOutput((v) => !v)}
            title={showNameOnOutput ? "Nome visível no output" : "Nome oculto no output"}
          >
            {showNameOnOutput ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            Nome
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border-light text-foreground text-[13px] font-medium hover:bg-card transition-colors"
            onClick={() => setShowQR(true)}
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border-light text-foreground text-[13px] font-medium hover:bg-card transition-colors"
            onClick={copyOutputLink}
          >
            {copiedOutput ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copiedOutput ? "Copiado!" : "Output link"}
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
            onClick={openOutput}
          >
            <Maximize2 className="w-4 h-4" />
            Output
          </button>
          <button
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-destructive/30 text-destructive text-[13px] font-medium hover:bg-destructive/10 transition-colors"
            onClick={handleLeaveRoom}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 p-4 overflow-y-auto">
        {participants.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Camera className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-base font-medium mb-2">Nenhuma câmera conectada</p>
            <p className="text-sm max-w-[360px] mx-auto">
              Partilha o QR code ou o link{" "}
              <span className="font-mono text-primary">/cam/{roomId}</span> com o público para eles começarem a transmitir.
            </p>
            <button
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light text-foreground text-sm font-medium hover:bg-card transition-colors"
              onClick={() => setShowQR(true)}
            >
              Mostrar QR Code
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {participants.map((p) => (
              <FeedCard key={p.id} peer={p} isSelected={selectedId === p.id} onSelect={() => handleSelect(p.id)} />
            ))}
          </div>
        )}
      </div>

      {showQR && <QRModal roomId={roomId || ""} link={cameraLink} onClose={() => setShowQR(false)} />}
    </div>
  );
}

function FeedCard({ peer, isSelected, onSelect }: { peer: PeerInfo; isSelected: boolean; onSelect: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);

  return (
    <div
      className="relative aspect-video rounded-xl overflow-hidden cursor-pointer transition-all border-2"
      style={{
        background: "hsl(var(--card))",
        borderColor: isSelected ? "hsl(var(--primary))" : "hsl(var(--border))",
        boxShadow: isSelected ? "0 0 0 1px hsl(var(--primary)), 0 0 30px rgba(59,130,246,0.15)" : "none",
      }}
      onClick={onSelect}
      onMouseEnter={(e) => { if (!isSelected) (e.currentTarget.style.borderColor = "hsl(var(--muted-foreground))"); }}
      onMouseLeave={(e) => { if (!isSelected) (e.currentTarget.style.borderColor = "hsl(var(--border))"); }}
    >
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <div
        className="absolute bottom-0 left-0 right-0 px-3 py-2 flex items-center justify-between"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}
      >
        <span className="text-[13px] font-medium">{peer.name}</span>
        <div className="flex items-center gap-2">
          {isSelected && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: "hsl(var(--danger-soft))", color: "hsl(var(--destructive))" }}>
              OUTPUT
            </span>
          )}
          <div className="w-2 h-2 rounded-full" style={{ background: "hsl(var(--success))", animation: "pulse-dot 2s ease-in-out infinite" }} />
        </div>
      </div>
    </div>
  );
}
