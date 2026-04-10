import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, X } from "lucide-react";

interface QRModalProps {
  roomId: string;
  link: string;
  onClose: () => void;
}

export default function QRModal({ roomId, link, onClose }: QRModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl p-8 max-w-[400px] w-full text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-2">Partilhar com o público</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Projeta este QR code no telão ou partilha o link
        </p>

        <div className="inline-block bg-white p-5 rounded-xl mb-4">
          <QRCodeSVG
            value={link}
            size={200}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
          />
        </div>

        <div className="mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-[2px]">
            Código da sala
          </span>
        </div>
        <div className="font-mono text-3xl font-semibold tracking-[6px] mb-5 text-primary">
          {roomId}
        </div>

        <div className="font-mono text-sm text-primary break-all p-3 bg-secondary rounded-lg mb-5">
          {link}
        </div>

        <div className="flex gap-3 justify-center">
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            onClick={handleCopy}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copiado!" : "Copiar link"}
          </button>
          <button
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg border border-border-light text-foreground font-medium text-sm hover:bg-card transition-colors"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
