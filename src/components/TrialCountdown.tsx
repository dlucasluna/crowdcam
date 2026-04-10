import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

function formatTime(ms: number) {
  if (ms <= 0) return "00:00:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TrialCountdown({ trialEnd }: { trialEnd: string }) {
  const [remaining, setRemaining] = useState(() => new Date(trialEnd).getTime() - Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining(new Date(trialEnd).getTime() - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [trialEnd]);

  const expired = remaining <= 0;
  const urgent = remaining > 0 && remaining < 3600000; // < 1h

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl border ${
        expired ? "border-destructive/50" : urgent ? "border-yellow-500/50" : "border-primary/30"
      }`}
      style={{ background: "hsl(var(--card))" }}
    >
      <div
        className="p-2 rounded-lg"
        style={{
          background: expired
            ? "hsl(var(--destructive) / 0.15)"
            : urgent
            ? "hsl(40 100% 50% / 0.15)"
            : "hsl(var(--accent-soft))",
        }}
      >
        <Clock className={`w-5 h-5 ${expired ? "text-destructive" : urgent ? "text-yellow-500" : "text-primary"}`} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">
          {expired ? "Trial expirado" : "Trial ativo"}
        </p>
        <p className="text-xs text-muted-foreground">
          {expired ? "Assina o Pro para continuar" : "Tempo restante"}
        </p>
      </div>
      <span
        className={`font-mono text-lg font-bold tracking-wider ${
          expired ? "text-destructive" : urgent ? "text-yellow-500" : "text-primary"
        }`}
      >
        {formatTime(remaining)}
      </span>
    </div>
  );
}
