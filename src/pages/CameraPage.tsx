import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  createSignalingChannel,
  sendSignal,
  type SignalMessage,
} from "@/lib/signaling";
import { handleOffer, handleIceCandidate, applyBitrateCap } from "@/lib/webrtc";
import type { RealtimeChannel } from "@supabase/supabase-js";
import {
  Camera,
  RefreshCw,
  Settings,
  Zap,
  ZoomIn,
  Sun,
  Target,
  CircleDot,
  X,
  Square,
  User,
} from "lucide-react";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function CameraPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const participantIdRef = useRef<string>("");
  const reannounceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [status, setStatus] = useState<"name" | "idle" | "connecting" | "live" | "error">("name");
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [participantName, setParticipantName] = useState("");
  const [showControls, setShowControls] = useState(false);

  // Camera capabilities
  const [capabilities, setCapabilities] = useState<any>({});
  const [torch, setTorch] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exposure, setExposure] = useState(0);
  const [focusMode, setFocusMode] = useState("continuous");
  const [whiteBalance, setWhiteBalance] = useState("continuous");

  const detectCapabilities = useCallback((track: MediaStreamTrack) => {
    try {
      if (!track.getCapabilities) {
        setCapabilities({});
        return;
      }
      const caps = track.getCapabilities();
      const setts = track.getSettings();
      setCapabilities(caps);
      if ((caps as any).zoom) setZoom((setts as any).zoom || (caps as any).zoom.min);
      if ((caps as any).exposureCompensation) setExposure((setts as any).exposureCompensation || 0);
    } catch {
      setCapabilities({});
    }
  }, []);

  const applyConstraint = useCallback(async (constraint: any) => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [constraint] });
    } catch (err) {
      console.warn("Could not apply constraint:", err);
    }
  }, []);

  // Create a peer connection for a viewer
  const createPeerForViewer = useCallback(
    (viewerId: string) => {
      if (!channelRef.current || !streamRef.current) return null;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (e) => {
        if (e.candidate && channelRef.current) {
          sendSignal(channelRef.current, {
            type: "ice",
            from: participantIdRef.current,
            to: viewerId,
            payload: e.candidate.toJSON(),
          });
        }
      };

      // Add local tracks
      streamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, streamRef.current!);
      });

      peersRef.current.set(viewerId, pc);
      return pc;
    },
    []
  );

  const connect = useCallback(async () => {
    if (!roomId) return;
    try {
      setStatus("connecting");
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 24 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setTimeout(() => {
        const track = stream.getVideoTracks()[0];
        if (track) detectCapabilities(track);
      }, 500);

      const id = `cam-${participantName.replace(/\s/g, "-")}-${Date.now()}`;
      participantIdRef.current = id;

      const channel = await createSignalingChannel(roomId, id, async (msg: SignalMessage) => {
        if (msg.type === "offer") {
          // Close existing connection for this viewer if any (they're sending a new offer)
          const existingPc = peersRef.current.get(msg.from);
          if (existingPc) {
            existingPc.close();
            peersRef.current.delete(msg.from);
          }
          const pc = createPeerForViewer(msg.from);
          if (pc) {
            await handleOffer(pc, channel, id, msg.from, msg.payload);
          }
        } else if (msg.type === "ice") {
          const pc = peersRef.current.get(msg.from);
          if (pc) {
            await handleIceCandidate(pc, msg.payload);
          }
        } else if (msg.type === "request-join") {
          // A new output just connected — re-announce so it discovers us
          sendSignal(channel, {
            type: "join",
            from: id,
            payload: { name: participantName },
          });
        }
      });

      channelRef.current = channel;

      // Send join immediately, then re-announce periodically to catch late joiners (admin/output)
      const announceJoin = () => {
        sendSignal(channel, {
          type: "join",
          from: id,
          payload: { name: participantName },
        });
      };
      
      announceJoin();
      // Re-announce every 5s continuously so late-opening output pages discover this camera
      const reannounceInterval = setInterval(announceJoin, 5000);
      reannounceRef.current = reannounceInterval;

      setStatus("live");
    } catch (err: any) {
      console.error("Error connecting:", err);
      setError(err.message || "Could not connect");
      setStatus("error");
    }
  }, [roomId, participantName, cameraFacing, detectCapabilities, createPeerForViewer]);

  const disconnect = useCallback(() => {
    if (reannounceRef.current) {
      clearInterval(reannounceRef.current);
      reannounceRef.current = null;
    }
    if (channelRef.current) {
      sendSignal(channelRef.current, {
        type: "leave",
        from: participantIdRef.current,
      });
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setCapabilities({});
    setTorch(false);
  }, []);

  const switchCamera = useCallback(async () => {
    const newFacing = cameraFacing === "environment" ? "user" : "environment";
    setCameraFacing(newFacing);

    if (status === "live" && streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newFacing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 24 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Replace tracks in all peer connections
      const newTrack = stream.getVideoTracks()[0];
      peersRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(newTrack);
      });

      setTimeout(() => {
        if (newTrack) detectCapabilities(newTrack);
      }, 500);
      setTorch(false);
      setZoom(1);
    }
  }, [cameraFacing, status, detectCapabilities]);

  const toggleTorch = useCallback(async () => {
    const newVal = !torch;
    await applyConstraint({ torch: newVal });
    setTorch(newVal);
  }, [torch, applyConstraint]);

  const handleZoom = useCallback(
    async (val: string) => {
      const numVal = parseFloat(val);
      setZoom(numVal);
      await applyConstraint({ zoom: numVal });
    },
    [applyConstraint]
  );

  const handleExposure = useCallback(
    async (val: string) => {
      const numVal = parseFloat(val);
      setExposure(numVal);
      await applyConstraint({ exposureMode: "manual", exposureCompensation: numVal });
    },
    [applyConstraint]
  );

  const handleFocusMode = useCallback(
    async (mode: string) => {
      setFocusMode(mode);
      await applyConstraint({ focusMode: mode });
    },
    [applyConstraint]
  );

  const handleWhiteBalance = useCallback(
    async (mode: string) => {
      setWhiteBalance(mode);
      await applyConstraint({ whiteBalanceMode: mode });
    },
    [applyConstraint]
  );

  const resetExposure = useCallback(async () => {
    setExposure(0);
    await applyConstraint({ exposureMode: "continuous" });
  }, [applyConstraint]);

  // Auto-connect when status becomes "idle" (after name entry)
  useEffect(() => {
    if (status === "idle") {
      connect();
    }
  }, [status, connect]);

  useEffect(() => {
    return () => {
      channelRef.current?.unsubscribe();
      peersRef.current.forEach((pc) => pc.close());
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const capsCount = [
    capabilities.torch,
    capabilities.zoom,
    capabilities.exposureCompensation,
    capabilities.focusMode?.length > 1,
    capabilities.whiteBalanceMode?.length > 1,
  ].filter(Boolean).length;

  // ====== NAME SCREEN ======
  if (status === "name") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-black p-6">
        <div className="w-full max-w-[360px] text-center">
          <div className="flex items-center justify-center gap-2 text-base font-semibold mb-8">
            <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span>CrowdCam</span>
          </div>
          <User className="w-12 h-12 mx-auto mb-2 opacity-40" />
          <h2 className="text-[22px] font-semibold mb-1.5 text-foreground">Como te chamas?</h2>
          <p className="text-sm text-muted-foreground mb-7">
            O teu nome aparece no telão quando fores selecionado
          </p>
          <form onSubmit={(e) => { e.preventDefault(); if (participantName.trim()) { setStatus("idle"); } }}>
            <input
              type="text"
              className="w-full px-4 py-3.5 bg-secondary border border-border rounded-lg text-foreground text-center text-lg placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors mb-4"
              placeholder="Ex: João Silva"
              value={participantName}
              onChange={(e) => setParticipantName(e.target.value)}
              maxLength={30}
              autoFocus
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium text-base transition-colors disabled:opacity-40"
              disabled={!participantName.trim()}
            >
              <Camera className="w-5 h-5" />
              Entrar na sala {roomId}
            </button>
          </form>
          <p className="text-xs text-muted-foreground mt-5">
            Ao entrar, a câmera do teu celular será ativada
          </p>
        </div>
      </div>
    );
  }

  // ====== CAMERA SCREEN ======
  return (
    <div className="h-screen flex flex-col bg-black relative overflow-hidden">
      {/* Header overlay */}
      <div className="absolute top-0 left-0 right-0 px-5 py-4 flex justify-between items-center z-10"
        style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)" }}>
        <div className="flex items-center gap-2 text-base font-semibold">
          <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span>CrowdCam</span>
        </div>
        <div className="flex items-center gap-2">
          {status === "live" && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "hsl(var(--danger-soft))", color: "hsl(var(--destructive))" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-destructive" style={{ animation: "pulse-dot 1.5s ease-in-out infinite" }} />
              AO VIVO
            </span>
          )}
          {status === "connecting" && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--primary))" }}>
              Conectando...
            </span>
          )}
        </div>
      </div>

      {/* Name badge */}
      {status === "live" && (
        <div className="absolute top-14 left-0 right-0 text-center z-10">
          <span className="inline-block px-3.5 py-1 rounded-full text-[13px] font-medium"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)", color: "rgba(255,255,255,0.8)" }}>
            {participantName}
          </span>
        </div>
      )}

      {/* Video */}
      {status === "live" || status === "connecting" ? (
        <video ref={videoRef} className="flex-1 object-cover w-full h-full" autoPlay playsInline muted />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
          <Camera className="w-16 h-16 opacity-20" />
          <p className="text-lg font-medium">{participantName}</p>
          <p className="text-sm">Sala: {roomId} — Toque para transmitir</p>
          {error && <p className="text-destructive text-[13px] max-w-[300px] text-center">{error}</p>}
        </div>
      )}

      {/* Controls panel */}
      {status === "live" && showControls && capsCount > 0 && (
        <div
          className="absolute right-0 top-20 bottom-24 w-[260px] z-20 overflow-y-auto flex flex-col gap-3.5 p-4"
          style={{
            background: "rgba(0,0,0,0.85)",
            backdropFilter: "blur(16px)",
            borderRadius: "12px 0 0 12px",
            animation: "slideInRight 0.3s ease-out",
          }}
        >
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-semibold">Controlos da câmera</span>
            <button onClick={() => setShowControls(false)} className="text-muted-foreground hover:text-foreground p-1">
              <X className="w-4 h-4" />
            </button>
          </div>

          {capabilities.torch && (
            <ControlItem icon={<Zap className="w-[18px] h-[18px]" style={{ fill: torch ? "#eab308" : "none" }} />} label="Lanterna">
              <button onClick={toggleTorch}
                className="w-12 h-[26px] rounded-full relative transition-colors"
                style={{ background: torch ? "hsl(var(--primary))" : "#333" }}>
                <div className="w-5 h-5 rounded-full bg-white absolute top-[3px] transition-all shadow-md"
                  style={{ left: torch ? 25 : 3 }} />
              </button>
            </ControlItem>
          )}

          {capabilities.zoom && (
            <ControlItem icon={<ZoomIn className="w-[18px] h-[18px]" />} label={`Zoom: ${zoom.toFixed(1)}x`}>
              <input type="range" min={capabilities.zoom.min} max={Math.min(capabilities.zoom.max, 10)}
                step={capabilities.zoom.step || 0.1} value={zoom}
                onChange={(e) => handleZoom(e.target.value)}
                className="w-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{capabilities.zoom.min}x</span>
                <span>{Math.min(capabilities.zoom.max, 10)}x</span>
              </div>
            </ControlItem>
          )}

          {capabilities.exposureCompensation && (
            <ControlItem icon={<Sun className="w-[18px] h-[18px]" />} label={`Exposição: ${exposure > 0 ? "+" : ""}${exposure.toFixed(1)}`}>
              <input type="range" min={capabilities.exposureCompensation.min} max={capabilities.exposureCompensation.max}
                step={capabilities.exposureCompensation.step || 0.1} value={exposure}
                onChange={(e) => handleExposure(e.target.value)}
                className="w-full" style={{ accentColor: "#eab308" }} />
              <button onClick={resetExposure}
                className="w-full mt-1 px-2.5 py-1 rounded-md text-[11px] text-muted-foreground bg-secondary border border-border hover:bg-card transition-colors">
                Reset (auto)
              </button>
            </ControlItem>
          )}

          {capabilities.focusMode?.length > 1 && (
            <ControlItem icon={<Target className="w-[18px] h-[18px]" />} label="Foco">
              <div className="flex gap-1.5">
                {capabilities.focusMode.map((mode: string) => (
                  <ModeButton key={mode}
                    label={mode === "continuous" ? "Auto" : mode === "manual" ? "Manual" : mode === "single-shot" ? "Toque" : mode}
                    active={focusMode === mode} onClick={() => handleFocusMode(mode)} />
                ))}
              </div>
            </ControlItem>
          )}

          {capabilities.whiteBalanceMode?.length > 1 && (
            <ControlItem icon={<CircleDot className="w-[18px] h-[18px]" />} label="Balanço de brancos">
              <div className="flex gap-1.5 flex-wrap">
                {capabilities.whiteBalanceMode.map((mode: string) => (
                  <ModeButton key={mode}
                    label={mode === "continuous" ? "Auto" : mode === "manual" ? "Manual" : mode}
                    active={whiteBalance === mode} onClick={() => handleWhiteBalance(mode)} />
                ))}
              </div>
            </ControlItem>
          )}
        </div>
      )}

      {/* Bottom controls */}
      <div className="absolute bottom-0 left-0 right-0 px-5 py-5 flex justify-center gap-4 z-10"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)" }}>
        {status === "live" && (
          <RoundButton onClick={switchCamera} title="Alternar câmera">
            <RefreshCw className="w-6 h-6" />
          </RoundButton>
        )}

        {(status === "idle" || status === "error") && (
          <RoundButton onClick={connect} size="lg" style={{ background: "hsl(var(--primary))", borderColor: "hsl(var(--primary))" }}>
            <Camera className="w-7 h-7" />
          </RoundButton>
        )}

        {status === "live" && (
          <RoundButton onClick={disconnect} size="lg" active>
            <Square className="w-6 h-6 fill-current" />
          </RoundButton>
        )}

        {status === "live" && capsCount > 0 && (
          <RoundButton onClick={() => setShowControls(!showControls)} title="Controlos"
            style={showControls ? { background: "rgba(59,130,246,0.3)", borderColor: "hsl(var(--primary))" } : {}}>
            <Settings className="w-[22px] h-[22px]" />
          </RoundButton>
        )}

        {status === "live" && capsCount === 0 && (
          <RoundButton style={{ opacity: 0.3, cursor: "default" }} title="Sem controlos avançados">
            <Settings className="w-[22px] h-[22px]" />
          </RoundButton>
        )}
      </div>
    </div>
  );
}

// Sub-components
function RoundButton({
  children, onClick, title, style, size, active,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  style?: React.CSSProperties;
  size?: "lg";
  active?: boolean;
}) {
  const sz = size === "lg" ? "w-[72px] h-[72px]" : "w-14 h-14";
  return (
    <button
      onClick={onClick}
      title={title}
      className={`${sz} rounded-full border-2 flex items-center justify-center text-white transition-all`}
      style={{
        borderColor: active ? "hsl(var(--destructive))" : "rgba(255,255,255,0.3)",
        background: active ? "hsl(var(--destructive))" : "rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function ControlItem({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="p-2.5 rounded-[10px] border" style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-[13px] font-medium text-gray-300">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ModeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 min-w-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
      style={{
        background: active ? "hsl(var(--primary))" : "#222",
        color: active ? "white" : "#888",
        border: active ? "1px solid hsl(var(--primary))" : "1px solid #333",
      }}
    >
      {label}
    </button>
  );
}
