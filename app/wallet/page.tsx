"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";

type Status =
  | "pending"
  | "stellar_pending"
  | "stellar_received"
  | "momo_initiated"
  | "completed"
  | "failed";

interface IncomingTransfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: Status;
  created_at: string;
  completed_at: string | null;
  beneficiaire: {
    full_name: string;
    phone: string;
    operator: "mtn" | "moov" | "celtiis";
  } | null;
  sender: { email: string; full_name: string | null } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente du dépôt expéditeur",
  stellar_pending: "Vérification blockchain",
  stellar_received: "Disponible pour retrait",
  momo_initiated: "Retrait en cours",
  completed: "Retiré sur MoMo",
  failed: "Échec",
};

const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  pending: { bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
  stellar_pending: { bg: "rgba(45,212,191,0.12)", fg: "#0d9488" },
  stellar_received: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  momo_initiated: { bg: "rgba(251,191,36,0.16)", fg: "#b45309" },
  completed: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  failed: { bg: "rgba(239,68,68,0.16)", fg: "#b91c1c" },
};

// Statuses where the receiver can trigger a withdraw. We're permissive in
// MVP — once Stellar verification is wired (J3) the rule will be tightened
// to stellar_received only.
const WITHDRAWABLE: Status[] = ["pending", "stellar_pending", "stellar_received"];

export default function WalletPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<IncomingTransfert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [noPhoneWarning, setNoPhoneWarning] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    setFetching(true);
    try {
      const res = await fetch("/api/inbox");
      const data = (await res.json()) as {
        items?: IncomingTransfert[];
        reason?: string;
      };
      setItems(data.items ?? []);
      setNoPhoneWarning(data.reason === "NO_PHONE_REGISTERED");
    } catch {
      setMessage({ kind: "err", text: "Impossible de charger vos transferts." });
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated]);

  async function withdraw(id: string) {
    setWithdrawing(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/withdrawals/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "err", text: data?.error?.message ?? "Échec du retrait." });
        return;
      }
      setMessage({
        kind: "ok",
        text: "Retrait initié. Vous recevrez une notification MoMo dans quelques secondes.",
      });
      await refresh();
    } finally {
      setWithdrawing(null);
    }
  }

  const stats = useMemo(() => {
    const pending = items.filter((t) => WITHDRAWABLE.includes(t.status));
    const completed = items.filter((t) => t.status === "completed");
    return {
      pendingXof: pending.reduce((acc, t) => acc + Number(t.amount_xof), 0),
      pendingCount: pending.length,
      totalReceived: completed.reduce((acc, t) => acc + Number(t.amount_xof), 0),
      totalReceivedCount: completed.length,
    };
  }, [items]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardShell
      title={`Bonjour ${user?.email.split("@")[0] ?? ""} 👋`}
      subtitle={
        noPhoneWarning
          ? "Renseignez votre numéro Mobile Money dans Paramètres pour commencer à recevoir."
          : stats.pendingCount > 0
            ? `Vous avez ${stats.pendingXof.toLocaleString("fr-FR")} XOF prêts à retirer.`
            : "Tout est à jour. Aucun retrait en attente."
      }
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        {/* --- Balance card --- */}
        <section
          style={{
            padding: 24,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-base))",
            border: "1px solid var(--primary)",
            boxShadow: "0 0 0 3px var(--primary-soft)",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Disponible au retrait
          </div>
          <div className="mono" style={{ fontSize: 40, fontWeight: 700, color: "var(--primary)", marginTop: 4 }}>
            {stats.pendingXof.toLocaleString("fr-FR")}
            <span style={{ fontSize: 16, marginLeft: 8, color: "var(--text-secondary)" }}>XOF</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
            {stats.pendingCount} transfert{stats.pendingCount > 1 ? "s" : ""} en attente · Total déjà reçu :{" "}
            <span className="mono">{stats.totalReceived.toLocaleString("fr-FR")} XOF</span>
          </div>
        </section>

        {/* --- Banner messages --- */}
        {noPhoneWarning && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
              color: "var(--gold, #b45309)",
              fontSize: 13,
            }}
          >
            ⚠️ Votre numéro Mobile Money n'est pas encore enregistré.{" "}
            <a href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>
              Ajoutez-le dans Paramètres
            </a>{" "}
            pour relier votre compte aux transferts qu'on vous envoie.
          </div>
        )}

        {message && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background:
                message.kind === "ok" ? "rgba(34,197,94,0.10)" : "rgba(234, 88, 12, 0.10)",
              color: message.kind === "ok" ? "#15803d" : "var(--accent, #EA580C)",
              fontSize: 13,
            }}
          >
            {message.text}
          </div>
        )}

        {/* --- Incoming transfers --- */}
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
            Transferts entrants
          </h3>

          {fetching ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)" }}>
              Chargement…
            </div>
          ) : items.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                border: "1px dashed var(--border)",
                borderRadius: 12,
                color: "var(--text-tertiary)",
                fontSize: 13,
              }}
            >
              Aucun transfert pour le moment.{" "}
              {!noPhoneWarning && "Demandez à un proche d'envoyer vers votre numéro."}
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((t) => {
                const c = STATUS_COLOR[t.status];
                const canWithdraw = WITHDRAWABLE.includes(t.status);
                const senderName = t.sender?.full_name ?? t.sender?.email ?? "Expéditeur";
                return (
                  <div
                    key={t.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr auto",
                      gap: 14,
                      alignItems: "center",
                      padding: 16,
                      borderRadius: 12,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{senderName}</div>
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)" }} className="mono">
                        {new Date(t.created_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="mono" style={{ fontWeight: 600, fontSize: 16 }}>
                        {Number(t.amount_xof).toLocaleString("fr-FR")} XOF
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        ≈ €{Number(t.amount_eur).toFixed(2)}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 600,
                          background: c.bg,
                          color: c.fg,
                        }}
                      >
                        {STATUS_LABEL[t.status]}
                      </span>
                      {canWithdraw && (
                        <button
                          className="btn btn-primary"
                          onClick={() => withdraw(t.id)}
                          disabled={withdrawing === t.id}
                          style={{ fontSize: 12, padding: "6px 14px" }}
                        >
                          {withdrawing === t.id ? "…" : "Retirer sur MoMo"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
