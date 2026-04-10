import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { generateRoomCode, createRoom } from "@/lib/room-utils";
import { Monitor, Camera } from "lucide-react";

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const code = generateRoomCode();
      await createRoom(code);
      navigate(`/admin/${code}`);
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      setCreating(false);
    }
  };

  const handleJoinAsCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/cam/${joinCode.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-[440px] text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 text-xl font-semibold mb-8">
          <div
            className="w-2 h-2 rounded-full bg-primary"
            style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
          />
          <span>CrowdCam</span>
        </div>

        <h1
          className="text-5xl font-bold tracking-tight mb-2"
          style={{
            background: "linear-gradient(135deg, #fff 0%, #888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Cada celular é uma câmera
        </h1>
        <p className="text-muted-foreground text-base mb-12 leading-relaxed">
          Transforme o público do seu evento em operadores de câmera.
          Transmita qualquer ângulo direto para o telão.
        </p>

        <button
          className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors disabled:opacity-50"
          onClick={handleCreateRoom}
          disabled={creating}
        >
          <Monitor className="w-5 h-5" />
          {creating ? "Criando..." : "Criar sala (admin)"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6 text-muted-foreground text-xs uppercase tracking-[2px]">
          <div className="flex-1 h-px bg-border" />
          <span>ou entrar como câmera</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form className="flex flex-col gap-3 mb-8" onSubmit={handleJoinAsCamera}>
          <input
            type="text"
            className="w-full px-4 py-3 bg-secondary border border-border rounded-lg text-foreground text-center font-mono tracking-wider text-lg placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            placeholder="Código da sala (ex: A3K9M2)"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={6}
          />
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border-light text-foreground font-medium text-sm hover:bg-card transition-colors disabled:opacity-40"
            disabled={!joinCode.trim()}
          >
            <Camera className="w-[18px] h-[18px]" />
            Entrar como câmera
          </button>
        </form>

        <p className="text-xs text-muted-foreground">
          v2.0 — 100% online via Lovable Cloud
        </p>
      </div>
    </div>
  );
}
