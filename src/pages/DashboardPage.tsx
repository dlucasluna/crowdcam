import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateRoomCode, createRoom, listActiveRooms, deactivateRoom } from "@/lib/room-utils";
import { Monitor, Camera, Trash2, LogIn, RefreshCw, LogOut, User, Crown, CreditCard, Check, Clock } from "lucide-react";
import TrialCountdown from "@/components/TrialCountdown";
import { toast } from "sonner";

type Room = { id: string; code: string; created_at: string; is_active: boolean };

export default function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signOut, subscribed, subscriptionEnd, trialEnd, isTrial, checkingSubscription, refreshSubscription } = useAuth();
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Assinatura ativada! Bem-vindo ao Pro 🎉");
      refreshSubscription();
    } else if (checkout === "cancel") {
      toast.info("Checkout cancelado");
    }
  }, [searchParams, refreshSubscription]);

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
    if (!subscribed) {
      toast.error("Precisas de uma assinatura Pro para criar salas");
      return;
    }
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

  const handleSubscribe = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast.error("Erro ao iniciar checkout");
    }
  };

  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err) {
      toast.error("Erro ao abrir portal de gestão");
    }
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
          {subscribed && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: isTrial ? "hsl(var(--accent-soft))" : "hsl(var(--success-soft))", color: isTrial ? "hsl(var(--primary))" : "hsl(var(--success))" }}>
              {isTrial ? <Clock className="w-3 h-3" /> : <Crown className="w-3 h-3" />}
              {isTrial ? "Trial" : "Pro"}
            </span>
          )}
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
          {/* Subscription banner */}
          {!checkingSubscription && !subscribed && (
            <div className="mb-8 p-5 rounded-xl border-2 border-primary/30 text-left"
              style={{ background: "hsl(var(--card))" }}>
              <div className="flex items-start gap-4">
                <div className="p-2.5 rounded-lg" style={{ background: "hsl(var(--accent-soft))" }}>
                  <Crown className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-lg mb-1">CrowdCam Pro</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Salas e câmeras ilimitadas para os teus eventos.
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1.5 mb-4">
                    {["Câmeras ilimitadas", "Salas ilimitadas", "Multi-output simultâneo", "Suporte prioritário"].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-primary" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="text-2xl font-bold">4€</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  <button
                    onClick={handleSubscribe}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    Assinar Pro
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Subscribed info */}
          {subscribed && (
            <div className="mb-6 flex items-center justify-between p-4 rounded-xl border border-border"
              style={{ background: "hsl(var(--card))" }}>
              <div className="text-left">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Crown className="w-4 h-4 text-primary" /> Plano Pro ativo
                </p>
                {subscriptionEnd && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Renova em {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
              <button
                onClick={handleManageSubscription}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <CreditCard className="w-3.5 h-3.5" />
                Gerir assinatura
              </button>
            </div>
          )}

          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #888 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            As tuas salas
          </h1>
          <p className="text-muted-foreground text-base mb-8 leading-relaxed">
            Cria e gere as tuas salas CrowdCam.
          </p>

          <button
            className="w-full inline-flex items-center justify-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors disabled:opacity-50"
            onClick={handleCreateRoom}
            disabled={creating || !subscribed}
          >
            <Monitor className="w-5 h-5" />
            {creating ? "Criando..." : "Criar nova sala"}
          </button>
          {!subscribed && !checkingSubscription && (
            <p className="text-xs text-muted-foreground mt-2">Assina o plano Pro para criar salas</p>
          )}

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
        </div>
      </div>
    </div>
  );
}
