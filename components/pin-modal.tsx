"use client";

/**
 * Modal de saisie PIN — sert à 2 cas d'usage :
 *  - mode="setup"  : définir un PIN (2 champs, "PIN" + "Confirmation")
 *  - mode="verify" : confirmer une action sensible (1 seul champ)
 *
 * Anti-brute-force côté serveur (5 essais → verrouillage 15 min).
 */

import React, { useState, useRef, useEffect } from "react";
import { Lock, ShieldCheck, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";

type Mode = "setup" | "verify";

interface PinModalProps {
  open: boolean;
  mode: Mode;
  /** Titre affiché ; défaut adapté au mode. */
  title?: string;
  /** Sous-titre / contexte de l'action (ex. "Confirme ton transfert de 200 €"). */
  subtitle?: string;
  /** Si true, la modale ne peut pas être fermée par l'utilisateur (utile pour setup). */
  blocking?: boolean;
  onClose: () => void;
  /** Appelée quand le PIN est validé côté serveur. */
  onSuccess: () => void;
}

const PIN_REGEX = /^\d{4,6}$/;

export function PinModal({ open, mode, title, subtitle, blocking, onClose, onSuccess }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (open) {
      setPin("");
      setConfirm("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const isSetup = mode === "setup";
  const canSubmit =
    PIN_REGEX.test(pin) && (isSetup ? PIN_REGEX.test(confirm) && pin === confirm : true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      if (isSetup && pin !== confirm) toast.error("Les deux PIN ne correspondent pas.");
      else toast.error("Le PIN doit faire 4 à 6 chiffres.");
      return;
    }

    setSubmitting(true);
    try {
      const url = isSetup ? "/api/pin" : "/api/pin/verify";
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Erreur.");
        return;
      }
      toast.success(isSetup ? "PIN défini avec succès." : "PIN validé.");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={blocking ? undefined : onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,14,0.65)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-elevated)",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
          border: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
              background: "var(--primary-soft)",
              color: "var(--primary)",
            }}
          >
            {isSetup ? <ShieldCheck size={22} /> : <Lock size={22} />}
          </div>
          {!blocking && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              style={{
                background: "transparent",
                border: 0,
                cursor: "pointer",
                color: "var(--text-tertiary)",
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 4px", letterSpacing: "-0.02em" }}>
          {title ?? (isSetup ? "Crée ton PIN de sécurité" : "Confirme ton PIN")}
        </h2>
        <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.45 }}>
          {subtitle ??
            (isSetup
              ? "4 à 6 chiffres. Ce PIN te sera demandé pour chaque action sensible (envoi, modification d'infos, retrait)."
              : "Saisis ton PIN pour confirmer.")}
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>{isSetup ? "Nouveau PIN" : "PIN"}</label>
            <div className="input">
              <input
                ref={inputRef}
                type="password"
                inputMode="numeric"
                pattern="\d{4,6}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••"
                autoComplete="off"
                style={{
                  letterSpacing: "0.5em",
                  fontSize: 18,
                  textAlign: "center",
                  fontFamily: "var(--font-mono, monospace)",
                }}
                required
              />
            </div>
          </div>

          {isSetup && (
            <div className="field">
              <label>Confirme ton PIN</label>
              <div className="input">
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4,6}"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  autoComplete="off"
                  style={{
                    letterSpacing: "0.5em",
                    fontSize: 18,
                    textAlign: "center",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                  required
                />
              </div>
              {confirm.length > 0 && confirm.length === pin.length && pin !== confirm && (
                <span style={{ color: "#b91c1c", fontSize: 11, marginTop: 4, display: "block" }}>
                  Les deux PIN ne correspondent pas.
                </span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-block"
            disabled={submitting || !canSubmit}
            style={{ marginTop: 8 }}
          >
            {submitting ? (
              <>
                <Spinner size={14} color="currentColor" />
                {isSetup ? "Création…" : "Vérification…"}
              </>
            ) : (
              <>{isSetup ? "Définir mon PIN" : "Valider"}</>
            )}
          </button>

          {!blocking && (
            <button type="button" onClick={onClose} className="btn btn-ghost btn-block" disabled={submitting}>
              Annuler
            </button>
          )}
        </form>

        {isSetup && (
          <p style={{ color: "var(--text-tertiary)", fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
            🔒 Ton PIN est hashé côté serveur (scrypt). Personne, pas même nous, ne peut le récupérer.
            Si tu l&apos;oublies, il faudra le réinitialiser via ton email.
          </p>
        )}
      </div>
    </div>
  );
}
