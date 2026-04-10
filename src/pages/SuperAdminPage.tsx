import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAdmin } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Users, CreditCard, ArrowLeft, RefreshCw, Search, Crown, Clock, XCircle, Trash2, X, Mail, Calendar, Hash, Monitor } from "lucide-react";
import { toast } from "sonner";

type ProfileRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string;
};

type SubscriptionInfo = {
  subscribed: boolean;
  status?: string;
  subscription_end?: string | null;
  trial_end?: string | null;
};

type RoomRow = {
  id: string;
  code: string;
  name: string | null;
  created_at: string;
  is_active: boolean;
};

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const { isAdmin, loading: adminLoading } = useAdmin();
  const { loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "subscriptions">("users");
  const [selectedUser, setSelectedUser] = useState<ProfileRow | null>(null);
  const [totalRooms, setTotalRooms] = useState(0);

  const fetchProfiles = useCallback(async () => {
    setLoadingProfiles(true);
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if (!error && data) setProfiles(data as ProfileRow[]);
    setLoadingProfiles(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const { count } = await supabase.from("rooms").select("*", { count: "exact", head: true }).eq("is_active", true);
    setTotalRooms(count ?? 0);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchProfiles();
      fetchStats();
    }
  }, [isAdmin, fetchProfiles, fetchStats]);

  if (authLoading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <p>Acesso negado.</p>
      </div>
    );
  }

  const filtered = profiles.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.display_name || "").toLowerCase().includes(q) ||
      (p.email || "").toLowerCase().includes(q) ||
      p.user_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-border bg-secondary flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 text-xl font-semibold">
            <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
            <span>CrowdCam</span>
          </div>
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
            style={{ background: "hsl(var(--danger-soft, 0 0% 50% / 0.1))", color: "hsl(var(--destructive))" }}>
            Admin
          </span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{profiles.length} utilizadores</span>
          <span>·</span>
          <span>{totalRooms} salas ativas</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pt-4 flex gap-1">
        {([["users", "Utilizadores", Users], ["subscriptions", "Subscrições", CreditCard]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-card"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {/* Search bar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
              placeholder="Procurar por nome, email ou ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => { fetchProfiles(); fetchStats(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingProfiles ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </div>

        {tab === "users" && <UsersTab profiles={filtered} loading={loadingProfiles} onSelectUser={setSelectedUser} />}
        {tab === "subscriptions" && <SubscriptionsTab profiles={filtered} loading={loadingProfiles} />}
      </div>

      {/* User detail modal */}
      {selectedUser && (
        <UserDetailModal
          profile={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  );
}

/* ─── User Detail Modal ─── */

function UserDetailModal({ profile, onClose }: { profile: ProfileRow; onClose: () => void }) {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [sub, setSub] = useState<(SubscriptionInfo & { email?: string }) | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  useEffect(() => {
    const fetchUserRooms = async () => {
      setLoadingRooms(true);
      const { data } = await supabase.from("rooms").select("*").eq("user_id", profile.user_id).order("created_at", { ascending: false });
      if (data) setRooms(data);
      setLoadingRooms(false);
    };

    const fetchUserSub = async () => {
      setLoadingSub(true);
      try {
        const { data, error } = await supabase.functions.invoke("admin-list-subscriptions");
        if (!error && data?.subscriptions) {
          const match = data.subscriptions.find((s: any) => s.user_id === profile.user_id);
          setSub(match || null);
        }
      } catch { /* ignore */ }
      setLoadingSub(false);
    };

    fetchUserRooms();
    fetchUserSub();
  }, [profile.user_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-border p-6 shadow-2xl"
        style={{ background: "hsl(var(--card))" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">{profile.display_name || "Sem nome"}</h2>
            {profile.email && (
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="w-3.5 h-3.5" />
                {profile.email}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <InfoCard icon={Hash} label="User ID" value={profile.user_id.slice(0, 12) + "…"} mono />
          <InfoCard icon={Calendar} label="Registado em" value={new Date(profile.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })} />
          <InfoCard
            icon={Crown}
            label="Plano"
            value={loadingSub ? "..." : !sub?.subscribed ? "Sem plano" : sub.status === "trialing" ? "Trial" : "Pro"}
          />
          <InfoCard
            icon={Monitor}
            label="Salas"
            value={loadingRooms ? "..." : `${rooms.filter(r => r.is_active).length} ativas / ${rooms.length} total`}
          />
        </div>

        {/* Subscription details */}
        {!loadingSub && sub?.subscribed && (
          <div className="mb-6 p-3 rounded-lg bg-secondary text-sm">
            <p className="text-muted-foreground">
              {sub.status === "trialing" && sub.trial_end
                ? `Trial termina em ${new Date(sub.trial_end).toLocaleDateString("pt-BR")}`
                : sub.subscription_end
                  ? `Renova em ${new Date(sub.subscription_end).toLocaleDateString("pt-BR")}`
                  : "Ativo"}
            </p>
          </div>
        )}

        {/* Rooms list */}
        <div>
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Salas ({rooms.length})
          </h3>
          {loadingRooms ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center border border-border rounded-lg">Nenhuma sala</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {rooms.map((r) => (
                <div key={r.id} className="flex items-center justify-between px-3 py-2 rounded-lg border border-border/50 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-primary">{r.code}</span>
                    {r.name && <span className="text-foreground">{r.name}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${r.is_active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div className="p-3 rounded-lg bg-secondary">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" />
        {label}
      </p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

/* ─── Users Tab ─── */

function UsersTab({ profiles, loading, onSelectUser }: { profiles: ProfileRow[]; loading: boolean; onSelectUser: (p: ProfileRow) => void }) {
  if (loading) return <p className="text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: "hsl(var(--card))" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">User ID</th>
            <th className="px-4 py-3">Registado em</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/50 hover:bg-secondary/50 transition-colors cursor-pointer"
              onClick={() => onSelectUser(p)}
            >
              <td className="px-4 py-3 font-medium">{p.display_name || "—"}</td>
              <td className="px-4 py-3 text-muted-foreground text-xs">{p.email || "—"}</td>
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{p.user_id.slice(0, 8)}…</td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(p.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
              </td>
            </tr>
          ))}
          {profiles.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Nenhum utilizador encontrado</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Subscriptions Tab ─── */

function SubscriptionsTab({ profiles, loading }: { profiles: ProfileRow[]; loading: boolean }) {
  const [subs, setSubs] = useState<Record<string, SubscriptionInfo & { email?: string }>>({});
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubs = useCallback(async () => {
    setLoadingSubs(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-subscriptions");
      if (error) throw error;
      if (data?.subscriptions) {
        const map: Record<string, SubscriptionInfo & { email?: string }> = {};
        for (const s of data.subscriptions) {
          if (s.user_id) {
            map[s.user_id] = { ...s, email: s.email };
          }
        }
        setSubs(map);
      }
    } catch (err) {
      console.error("Error fetching subs:", err);
      toast.error("Erro ao carregar subscrições");
    } finally {
      setLoadingSubs(false);
    }
  }, []);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const handleAssignPlan = async (userId: string, email: string) => {
    setActionLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-assign-plan", {
        body: { email, action: "assign" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano atribuído com sucesso");
      fetchSubs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atribuir plano");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemovePlan = async (userId: string, email: string) => {
    setActionLoading(userId);
    try {
      const { data, error } = await supabase.functions.invoke("admin-assign-plan", {
        body: { email, action: "remove" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Plano removido com sucesso");
      fetchSubs();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover plano");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || loadingSubs) return <p className="text-muted-foreground text-sm">Carregando...</p>;

  return (
    <div className="rounded-xl border border-border overflow-hidden" style={{ background: "hsl(var(--card))" }}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
            <th className="px-4 py-3">Nome</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Válido até</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => {
            const sub = subs[p.user_id] || null;
            const status = sub?.status;
            const email = p.email || sub?.email || p.display_name || "";
            const isLoading = actionLoading === p.user_id;
            return (
              <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 font-medium">{p.display_name || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{p.email || "—"}</td>
                <td className="px-4 py-3">
                  {!sub || !sub.subscribed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-muted-foreground bg-secondary">
                      <XCircle className="w-3 h-3" /> Sem plano
                    </span>
                  ) : status === "trialing" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--primary))" }}>
                      <Clock className="w-3 h-3" /> Trial
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{ background: "hsl(var(--success-soft))", color: "hsl(var(--success))" }}>
                      <Crown className="w-3 h-3" /> Pro
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {sub?.subscription_end ? new Date(sub.subscription_end).toLocaleDateString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  {!sub || !sub.subscribed ? (
                    <button
                      disabled={isLoading}
                      onClick={() => handleAssignPlan(p.user_id, email)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      <Crown className="w-3 h-3" />
                      {isLoading ? "..." : "Atribuir Pro"}
                    </button>
                  ) : (
                    <button
                      disabled={isLoading}
                      onClick={() => handleRemovePlan(p.user_id, email)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-3 h-3" />
                      {isLoading ? "..." : "Remover"}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {profiles.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum utilizador encontrado</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
