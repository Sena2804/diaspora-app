"use client";

import React, { useEffect, useState } from "react";
import { Phone, X, RefreshCw } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

interface PhoneVerifyModalProps {
  open: boolean;
  /** Numéro affiché dans la modale (juste pour l'UI). */
  phone: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function PhoneVerifyModal({ open, phone, onClose, onSuccess }: PhoneVerifyModalProps) {
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setCode("");
      setDemoCode(null);
    }
  }, [open]);

  if (!open) return null;

  const send = async () => {
    setSending(true);
    setDemoCode(null);
    try {
      const res = await fetch("/api/otp/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de l'envoi.");
        return;
      }
      if (data?.demo_code) {
        setDemoCode(data.demo_code);
        toast.info("Code envoyé (mode démo : affiché à l'écran).");
      } else {
        toast.success("Code envoyé par SMS.");
      }
    } finally {
      setSending(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) {
      toast.error("Le code doit faire 6 chiffres.");
      return;
    }
    setVerifying(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Code invalide.");
        return;
      }
      toast.success("Numéro vérifié ✓");
      onSuccess();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(2,6,14,0.65)", display: "grid", placeItems: "center", zIndex: 100, padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 400, background: "var(--bg-elevated)", borderRadius: 16, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid var(--border-subtle)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--primary-soft)", color: "var(--primary)" }}>
            <Phone size={22} />
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 4px" }}>Vérifie ton numéro</h2>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
          On envoie un code à 6 chiffres au{" "}
          <strong className="mono" style={{ color: "var(--text-primary)" }}>{phone ?? "—"}</strong>.
          Tu pourras alors recevoir de l&apos;argent.
        </p>

        {!demoCode ? (
          <button type="button" onClick={send} disabled={sending} className="btn btn-primary btn-block">
            {sending ? <><Spinner size={14} />Envoi…</> : "Envoyer le code"}
          </button>
        ) : (
          <div style={{ padding: 14, marginBottom: 14, borderRadius: 10, background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", fontSize: 13 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>📱 Mode démo</div>
            Ton code : <span className="mono" style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.2em" }}>{demoCode}</span>
            <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-tertiary)" }}>
              En prod ce code arriverait par SMS. Là il s&apos;affiche ici pour la démo.
            </div>
          </div>
        )}

        <form onSubmit={verify} style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
          <div className="field">
            <label>Code reçu</label>
            <div className="input">
              <input
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                style={{ letterSpacing: "0.35em", fontSize: 18, textAlign: "center", fontFamily: "var(--font-mono, monospace)" }}
                autoComplete="off"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={verifying || code.length !== 6}>
            {verifying ? <><Spinner size={14} />Vérification…</> : "Valider mon numéro"}
          </button>
          {demoCode && (
            <button type="button" onClick={send} disabled={sending} className="btn btn-ghost btn-block" style={{ fontSize: 12 }}>
              <RefreshCw size={12} /> Renvoyer un nouveau code
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
