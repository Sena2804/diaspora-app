"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase/client";

export default function SettingsPage() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [phone, setPhone] = useState("");
  const [savingPhone, setSavingPhone] = useState(false);
  const [phoneMessage, setPhoneMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (user?.phone) setPhone(user.phone);
  }, [user?.phone]);

  if (loading || !isAuthenticated) return null;

  async function savePhone(e: React.FormEvent) {
    e.preventDefault();
    setSavingPhone(true);
    setPhoneMessage(null);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phone.trim() })
        .eq("id", user!.id);
      if (error) {
        setPhoneMessage({ kind: "err", text: error.message });
      } else {
        setPhoneMessage({ kind: "ok", text: "Numéro enregistré." });
        // Wait a moment then reload so AuthContext re-hydrates from profile.
        setTimeout(() => window.location.reload(), 700);
      }
    } finally {
      setSavingPhone(false);
    }
  }

  return (
    <DashboardShell title="Paramètres" subtitle="Votre compte et vos préférences.">
      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        <section style={card()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Profil</h3>
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Rôle" value={user?.role === "receiver" ? "Bénéficiaire" : "Expéditeur (diaspora)"} />
          <Row label="ID utilisateur" value={user?.id ?? "—"} mono />
        </section>

        <section style={card()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px" }}>Numéro Mobile Money</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 14px" }}>
            {user?.role === "receiver"
              ? "Ce numéro relie votre compte aux transferts que la diaspora vous envoie."
              : "Numéro où vous pourriez recevoir des transferts en retour."}
          </p>
          <form onSubmit={savePhone} style={{ display: "grid", gap: 10 }}>
            <div className="field">
              <label>Format international (+229…)</label>
              <input
                type="tel"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+22997123456"
                style={{ padding: "10px 12px" }}
              />
            </div>
            {phoneMessage && (
              <div
                style={{
                  padding: 10,
                  borderRadius: 8,
                  background:
                    phoneMessage.kind === "ok"
                      ? "rgba(34,197,94,0.10)"
                      : "rgba(234, 88, 12, 0.10)",
                  color: phoneMessage.kind === "ok" ? "#15803d" : "var(--accent, #EA580C)",
                  fontSize: 13,
                }}
              >
                {phoneMessage.text}
              </div>
            )}
            <button type="submit" className="btn btn-primary" disabled={savingPhone}>
              {savingPhone ? "Enregistrement…" : "Enregistrer"}
            </button>
          </form>
        </section>

        <section style={card()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Sécurité</h3>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: "0 0 14px" }}>
            Authentification à deux facteurs et changement de mot de passe arrivent avec la v1.1.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => logout()}
            style={{ color: "var(--accent, #EA580C)" }}
          >
            Se déconnecter
          </button>
        </section>
      </div>
    </DashboardShell>
  );
}

function card(): React.CSSProperties {
  return {
    padding: 22,
    borderRadius: 16,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
  };
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "10px 0",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 14,
      }}
    >
      <span style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className={mono ? "mono" : ""} style={{ fontSize: mono ? 12 : 14 }}>
        {value}
      </span>
    </div>
  );
}
