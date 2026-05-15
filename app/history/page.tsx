"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Inbox, CheckCircle2, PiggyBank, Wallet } from "lucide-react";
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

type FilterKey =
  | "all"
  | "sent"
  | "received"
  | "momo_withdrawal"
  | "vault_withdrawal"
  | "pending"
  | "failed";

const FILTERS: FilterKey[] = [
  "all",
  "sent",
  "received",
  "momo_withdrawal",
  "vault_withdrawal",
  "pending",
  "failed",
];

const FILTER_LABEL: Record<FilterKey, string> = {
  all: "Tout",
  sent: "Envois",
  received: "Réceptions",
  momo_withdrawal: "Retraits MoMo",
  vault_withdrawal: "Retraits coffres",
  pending: "En attente",
  failed: "Échecs",
};

interface VaultWithdrawal {
  id: string;
  amount_xof: number;
  occurred_at: string;
  note: string | null;
  vault: { id: string; name: string } | null;
}

type HistoryRow =
  | { kind: "transfer"; data: Transfert; ts: number }
  | { kind: "vault_withdrawal"; data: VaultWithdrawal; ts: number };

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { confirmWithPin } = usePinConfirm();
  const toast = useToast();

  const [items, setItems] = useState<Transfert[]>([]);
  const [vaultWithdrawals, setVaultWithdrawals] = useState<VaultWithdrawal[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [finalizing, setFinalizing] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    try {
      const [tRes, wRes] = await Promise.all([
        fetch("/api/transferts?limit=50"),
        fetch("/api/vaults/withdrawals"),
      ]);
      const tData = (await tRes.json()) as { items?: Transfert[] };
      const wData = (await wRes.json()) as { items?: VaultWithdrawal[] };
      setItems(tData.items ?? []);
      setVaultWithdrawals(wData.items ?? []);
    } catch {
      setItems([]);
      setVaultWithdrawals([]);
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

  // Liste unifiée triée par date, transferts + retraits coffres.
  const merged: HistoryRow[] = [
    ...items.map<HistoryRow>((t) => ({ kind: "transfer", data: t, ts: new Date(t.created_at).getTime() })),
    ...vaultWithdrawals.map<HistoryRow>((w) => ({ kind: "vault_withdrawal", data: w, ts: new Date(w.occurred_at).getTime() })),
  ].sort((a, b) => b.ts - a.ts);

  // Un retrait MoMo = transfert reçu dont l'état a dépassé "stellar_received"
  // (= le destinataire a déclenché le payout Mobile Money).
  const isMomoWithdrawal = (t: Transfert): boolean =>
    t.direction === "received" && (t.status === "momo_initiated" || t.status === "completed");

  const filtered = merged.filter((row) => {
    if (filter === "all") return true;
    if (filter === "vault_withdrawal") return row.kind === "vault_withdrawal";
    if (row.kind !== "transfer") return false;
    const t = row.data;
    switch (filter) {
      case "sent": return t.direction === "sent";
      case "received": return t.direction === "received" && !isMomoWithdrawal(t);
      case "momo_withdrawal": return isMomoWithdrawal(t);
      case "pending": return t.status === "pending" || t.status === "stellar_pending";
      case "failed": return t.status === "failed";
      default: return false;
    }
  });

  const totalCount = merged.length;

  return (
    <DashboardShell title="Historique" subtitle={`${totalCount} opération${totalCount > 1 ? "s" : ""} au total`}>
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
              {FILTER_LABEL[s] ?? s}
            </button>
          ))}
        </div>

        {fetching ? (
          <SkeletonRows count={4} />
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0 }}>
              {filter === "all" ? "Aucune opération pour le moment." : "Aucune opération dans cette catégorie."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((row) => {
              if (row.kind === "vault_withdrawal") {
                const w = row.data;
                const amount = Math.abs(Number(w.amount_xof));
                return (
                  <div
                    key={`vw-${w.id}`}
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
                        background: "rgba(45,212,191,0.16)",
                        color: "#0d9488",
                      }}
                      title="Retrait coffre"
                    >
                      <PiggyBank size={14} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Retrait de la caisse
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        « {w.vault?.name ?? "Caisse supprimée"} »
                      </div>
                      {w.note && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>
                          {w.note}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="mono" style={{ fontWeight: 600, color: "#0d9488" }}>
                        +{amount.toLocaleString("fr-FR")} XOF
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                        ≈ €{(amount / 655.957).toFixed(2)}
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
                          background: "rgba(45,212,191,0.16)",
                          color: "#0d9488",
                        }}
                      >
                        Coffre clôturé
                      </span>
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                        {new Date(w.occurred_at).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <div />
                  </div>
                );
              }

              const t = row.data;
              const color = STATUS_COLOR[t.status];
              const isSent = t.direction === "sent";
              const isMomo = isMomoWithdrawal(t);
              const counterparty = isSent
                ? t.recipient?.full_name ?? t.beneficiaire?.full_name ?? "—"
                : t.sender?.full_name ?? "—";
              const counterpartyId = isSent ? t.recipient?.wallet_id : t.sender?.wallet_id;
              const needsFinalize = isSent && t.status === "pending";

              // Couleur d'icône & libellé selon le type d'opération.
              const iconBg = isSent
                ? "rgba(249,115,22,0.12)"
                : isMomo
                  ? "rgba(251,191,36,0.16)"
                  : "rgba(34,197,94,0.12)";
              const iconFg = isSent ? "#ea580c" : isMomo ? "#b45309" : "#15803d";
              const headerLabel = isSent
                ? `À ${counterparty}`
                : isMomo
                  ? `Retrait MoMo (transfert de ${counterparty})`
                  : `De ${counterparty}`;

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
                      background: iconBg,
                      color: iconFg,
                    }}
                    title={isSent ? "Envoyé" : isMomo ? "Retrait MoMo" : "Reçu"}
                  >
                    {isSent ? <Send size={14} /> : isMomo ? <Wallet size={14} /> : <Inbox size={14} />}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{headerLabel}</div>
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
