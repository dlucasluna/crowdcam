import { useNavigate } from "react-router-dom";
import { Monitor, Camera, Zap, Users, Tv, ArrowRight, QrCode, Crown, Check, X, CreditCard, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleCTA = () => {
    navigate(user ? "/dashboard" : "/auth");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="px-6 py-4 flex items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <div className="w-2 h-2 rounded-full bg-primary" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
          <span>CrowdCam</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate("/auth")}
                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Entrar
              </button>
              <button
                onClick={() => navigate("/auth")}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Começar grátis
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{ background: "hsl(var(--accent-soft))", color: "hsl(var(--primary))" }}>
          <Zap className="w-3.5 h-3.5" />
          100% browser — sem app, sem instalar nada
        </div>

        <h1
          className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-4 max-w-[800px] leading-[1.1]"
          style={{
            background: "linear-gradient(135deg, #fff 0%, #888 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Cada celular é uma câmera
        </h1>
        <p className="text-muted-foreground text-lg sm:text-xl max-w-[560px] mb-10 leading-relaxed">
          Transforme o público do seu evento em operadores de câmera. Transmita qualquer ângulo direto para o telão, em tempo real.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={handleCTA}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors"
          >
            <Monitor className="w-5 h-5" />
            Começar grátis
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#como-funciona"
            className="inline-flex items-center gap-2 px-6 py-4 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-card transition-colors"
          >
            Ver como funciona
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="px-6 py-20 border-t border-border/50">
        <div className="max-w-[960px] mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            Como funciona
          </h2>
          <p className="text-muted-foreground text-center mb-12 max-w-[480px] mx-auto">
            Três passos para transformar qualquer evento numa produção multi-câmera.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                icon: Monitor,
                title: "Cria uma sala",
                desc: "Em segundos, cria uma sala e recebe um código único para partilhar.",
              },
              {
                step: "02",
                icon: QrCode,
                title: "Partilha o QR code",
                desc: "O público escaneia o QR code e a câmera do celular liga automaticamente.",
              },
              {
                step: "03",
                icon: Tv,
                title: "Escolhe o ângulo",
                desc: "No painel admin, vê todas as câmeras ao vivo e seleciona qual vai para o telão.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative p-6 rounded-xl border border-border transition-colors hover:border-primary/30"
                style={{ background: "hsl(var(--card))" }}
              >
                <span className="text-xs font-mono text-primary/50 mb-4 block">{item.step}</span>
                <item.icon className="w-8 h-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-border/50">
        <div className="max-w-[960px] mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            Tudo o que precisas
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              { icon: Camera, title: "Câmeras ilimitadas", desc: "Qualquer pessoa com um celular pode ser uma câmera. Sem limites." },
              { icon: Zap, title: "Latência ultra-baixa", desc: "WebRTC peer-to-peer — o vídeo chega ao telão em milissegundos." },
              { icon: Users, title: "Multi-output", desc: "Abra vários outputs no mesmo evento. Cada tela, um ângulo diferente." },
              { icon: Tv, title: "Pronto para OBS", desc: "Abre o output no OBS via Browser Source para transmissões profissionais." },
            ].map((f) => (
              <div
                key={f.title}
                className="flex items-start gap-4 p-5 rounded-xl border border-border"
                style={{ background: "hsl(var(--card))" }}
              >
                <div className="p-2.5 rounded-lg" style={{ background: "hsl(var(--accent-soft))" }}>
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-6 py-20 border-t border-border/50">
        <div className="max-w-[800px] mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #aaa 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>
            Simples e acessível
          </h2>
          <p className="text-muted-foreground text-center mb-12">
            Experimenta grátis durante 24 horas. Cancela quando quiseres.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Câmera (free) */}
            <div className="p-6 rounded-xl border border-border text-left"
              style={{ background: "hsl(var(--card))" }}>
              <div className="flex items-center gap-2 mb-1">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="font-semibold text-lg">Câmera</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Para participantes do evento</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold">Grátis</span>
              </div>
              <ul className="text-sm space-y-2.5 mb-6">
                {[
                  { text: "Transmitir câmera pelo celular", ok: true },
                  { text: "Entrar em salas com código", ok: true },
                  { text: "Sem cadastro necessário", ok: true },
                  { text: "Criar salas", ok: false },
                  { text: "Painel admin", ok: false },
                  { text: "Multi-output", ok: false },
                ].map((f) => (
                  <li key={f.text} className={`flex items-center gap-2 ${f.ok ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
                    {f.ok
                      ? <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      : <X className="w-4 h-4 flex-shrink-0" />
                    }
                    {f.text}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/auth")}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors"
              >
                Entrar como câmera
              </button>
            </div>

            {/* Pro */}
            <div className="relative p-6 rounded-xl border-2 border-primary/40 text-left"
              style={{ background: "hsl(var(--card))" }}>
              <div className="absolute -top-3 right-4 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground">
                <Clock className="w-3 h-3" />
                24h grátis
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">Pro</span>
              </div>
              <p className="text-xs text-muted-foreground mb-4">Para organizadores de eventos</p>
              <div className="flex items-baseline gap-1 mb-5">
                <span className="text-3xl font-bold">4€</span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <ul className="text-sm space-y-2.5 mb-6">
                {[
                  "Tudo do plano Câmera",
                  "Criar salas ilimitadas",
                  "Câmeras ilimitadas por sala",
                  "Painel admin com grid ao vivo",
                  "Multi-output simultâneo",
                  "Integração com OBS",
                  "Suporte prioritário",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={handleCTA}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-base hover:bg-primary/90 transition-colors"
              >
                <CreditCard className="w-4 h-4" />
                Experimentar 24h grátis
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-muted-foreground text-center mt-3">
                Sem cobrança durante o trial. Cancela a qualquer momento.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-border/50 text-center">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/50" />
          <span>CrowdCam v3.0</span>
        </div>
      </footer>
    </div>
  );
}
