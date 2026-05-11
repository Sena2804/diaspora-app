"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";

export default function SettingsPage() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardShell title="Paramètres" subtitle="Votre compte et vos préférences.">
      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Profil</h3>
          <Row label="Email" value={user?.email ?? "—"} />
          <Row label="Rôle" value={user?.role === "receiver" ? "Bénéficiaire" : "Expéditeur (diaspora)"} />
          <Row label="ID utilisateur" value={user?.id ?? "—"} mono />
        </section>

        <section
          style={{
            padding: 22,
            borderRadius: 16,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
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
