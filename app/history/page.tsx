"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Inbox, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";

type Status =
  | "pending"
  | "stellar_pending"
  | "stellar_received"
  | "momo_initiated"
  | "completed"
  | "failed";

interface ProfileLite {
  wallet_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  country: string | null;
}

interface Transfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: Status;
  stellar_tx_hash: string | null;
  payout_provider_id: string | null;
  motif: string | null;
  direction: "sent" | "received";
  created_at: string;
  completed_at: string | null;
  recipient: ProfileLite | null;
  sender: ProfileLite | null;
  beneficiaire: { full_name: string; phone: string; operator: string } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente",
  stellar_pending: "Stellar en cours",
  stellar_received: "USDC reçus",
  momo_initiated: "MoMo en cours",
  completed: "Livré",
  failed: "Échec",
};

const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  pending: { bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
  stellar_pending: { bg: "rgba(45,212,191,0.12)", fg: "#0d9488" },
  stellar_received: { bg: "rgba(45,212,191,0.18)", fg: "#0d9488" },
  momo_initiated: { bg: "rgba(251,191,36,0.16)", fg: "#b45309" },
  completed: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  failed: { bg: "rgba(239,68,68,0.16)", fg: "#b91c1c" },
};

const FILTERS: ("all" | Status)[] = ["all", "pending", "momo_initiated", "completed", "failed"];

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { confirmWithPin } = usePinConfirm();
  const toast = useToast();

  const [items, setItems] = useState<Transfert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [finalizing, setFinalizing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    try {
      const r = await fetch("/api/transferts?limit=50");
      const data = (await r.json()) as { items?: Transfert[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh().finally(() => setFetching(false));
  }, [isAuthenticated]);

  useEffect(() => {
    const hasInFlight = items.some((t) =>
      ["stellar_pending", "stellar_received", "momo_initiated"].includes(t.status),
    );
    if (!hasInFlight) return;
    const id = window.setInterval(refresh, 4000);
    return () => window.clearInterval(id);
  }, [items]);

  if (loading || !isAuthenticated) return null;

  async function finalize(t: Transfert) {
    const recipientName = t.recipient?.full_name ?? t.beneficiaire?.full_name ?? "le destinataire";
    const ok = await confirmWithPin({
      title: "Finaliser le transfert",
      subtitle: `Tu autorises le débit de ${t.amount_eur.toFixed(2)} € pour ${recipientName}.`,
    });
    if (!ok) {
      toast.info("Finalisation annulée.");
      return;
    }
    setFinalizing(t.id);
    try {
      const res = await fetch(`/api/transferts/${t.id}/submit-stellar`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la finalisation.");
        return;
      }
      toast.success("Transfert finalisé. Le bénéficiaire peut maintenant retirer.");
      await refresh();
    } finally {
      setFinalizing(null);
    }
  }

  const filtered = filter === "all" ? items : items.filter((t) => t.status === filter);

  return (
    <DashboardShell title="Historique" subtitle={`${items.length} transfert${items.length > 1 ? "s" : ""} au total`}>
      <div style={{ display: "grid", gap: 16, maxWidth: 980 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              style={{
                cursor: "pointer",
                borderRadius: 999,
                border: "1px solid var(--border)",
                background: filter === s ? "var(--primary)" : "var(--bg-elevated)",
                color: filter === s ? "var(--bg-base)" : "var(--text-secondary)",
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {s === "all" ? "Tous" : STATUS_LABEL[s as Status]}
            </button>
          ))}
        </div>

        {fetching ? (
          <SkeletonRows count={4} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>
              {filter === "all" ? "Aucun transfert pour le moment." : "Aucun transfert dans cette catégorie."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((t) => {
              const color = STATUS_COLOR[t.status];
              const isSent = t.direction === "sent";
              const counterparty = isSent
                ? t.recipient?.full_name ?? t.beneficiaire?.full_name ?? "—"
                : t.sender?.full_name ?? "—";
              const counterpartyId = isSent ? t.recipient?.wallet_id : t.sender?.wallet_id;
              const needsFinalize = isSent && t.status === "pending";

              return (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "auto 1.5fr 1fr 1fr auto",
                    gap: 14,
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 12,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      display: "grid",
                      placeItems: "center",
                      background: isSent ? "rgba(249,115,22,0.12)" : "rgba(34,197,94,0.12)",
                      color: isSent ? "#ea580c" : "#15803d",
                    }}
                    title={isSent ? "Envoyé" : "Reçu"}
                  >
                    {isSent ? <Send size={14} /> : <Inbox size={14} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {isSent ? "À " : "De "}
                      {counterparty}
                    </div>
                    {counterpartyId && (
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        {counterpartyId}
                      </div>
                    )}
                    {t.motif && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>
                        « {t.motif} »
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {Number(t.amount_eur).toFixed(2)} €
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {Number(t.amount_xof).toLocaleString("fr-FR")} XOF
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "4px 10px",
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: color.bg,
                        color: color.fg,
                      }}
                    >
                      {STATUS_LABEL[t.status]}
                    </span>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                      {new Date(t.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div>
                    {needsFinalize ? (
                      <button
                        onClick={() => finalize(t)}
                        disabled={finalizing === t.id}
                        className="btn btn-primary"
                        style={{ fontSize: 12, padding: "6px 12px" }}
                      >
                        {finalizing === t.id ? (
                          <>
                            <Spinner size={12} />
                            Signature…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={12} />
                            Finaliser
                          </>
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
