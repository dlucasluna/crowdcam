import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { generateRoomCode, createRoom, listActiveRooms, deactivateRoom } from "@/lib/room-utils";
import { Monitor, Camera, Trash2, LogIn, RefreshCw, LogOut, User } from "lucide-react";
import { toast } from "sonner";

type Room = { id: string; code: string; created_at: string; is_active: boolean };

export default function Home() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const data = await listActiveRooms();
      setRooms(data);
    } catch (err) {
      console.error("Erro ao carregar salas:", err);
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => { fetchRooms(); }, []);

  const handleCreateRoom = async () => {
    setCreating(true);
    try {
      const code = generateRoomCode();
      await createRoom(code);
      navigate(`/admin/${code}`);
    } catch (err) {
      console.error("Erro ao criar sala:", err);
      toast.error("Erro ao criar sala");
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (code: string) => {
    try {
      await deactivateRoom(code);
      setRooms((prev) => prev.filter((r) => r.code !== code));
      toast.success("Sala removida!");
    } catch (err) {
      toast.error("Erro ao remover sala");
    }
  };

  const handleJoinAsCamera = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinCode.trim()) {
      navigate(`/cam/${joinCode.trim().toUpperCase()}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-border bg-secondary flex-shrink-0">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span>CrowdCam</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {user?.user_metadata?.full_name || user?.email}
          </span>
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sair
          </button>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[520px] text-center">
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
          <p className="text-muted-foreground text-base mb-10 leading-relaxed">
            Transforme o público do seu evento em operadores de câmera.
            Transmita qualquer ângulo direto para o telão.
          </p>

          <button
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={handleCreateRoom}
            disabled={creating}
          >
            <Monitor className="w-5 h-5" />
            {creating ? "Criando..." : "Criar nova sala"}
          </button>

          {/* Active rooms */}
          <div className="mt-8 text-left">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Minhas salas ({rooms.length})
              </h2>
              <button
                onClick={fetchRooms}
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="Atualizar"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? "animate-spin" : ""}`} />
              </button>
            </div>

            {rooms.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground border border-border rounded-lg" style={{ background: "hsl(var(--card))" }}>
                {loadingRooms ? "Carregando..." : "Nenhuma sala ativa"}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border transition-colors"
                    style={{ background: "hsl(var(--card))" }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold tracking-wider text-primary">{room.code}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(room.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => navigate(`/admin/${room.code}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                        title="Entrar como admin"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        Entrar
                      </button>
                      <button
                        onClick={() => handleDeleteRoom(room.code)}
                        className="inline-flex items-center p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Remover sala"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-card transition-colors disabled:opacity-40"
              disabled={!joinCode.trim()}
            >
              <Camera className="w-[18px] h-[18px]" />
              Entrar como câmera
            </button>
          </form>

          <p className="text-xs text-muted-foreground">
            v3.0 — CrowdCam SaaS
          </p>
        </div>
      </div>
    </div>
  );
}
