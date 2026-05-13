"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

type Status =
  | "pending"
  | "stellar_pending"
  | "stellar_received"
  | "momo_initiated"
  | "completed"
  | "failed";

interface Transfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: Status;
  stellar_tx_hash: string | null;
  payout_provider_id: string | null;
  created_at: string;
  completed_at: string | null;
  beneficiaire: {
    id: string;
    full_name: string;
    phone: string;
    operator: "mtn" | "moov" | "celtiis";
    country: string;
  } | null;
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

const STATUSES: ("all" | Status)[] = ["all", "pending", "momo_initiated", "completed", "failed"];

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Transfert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [filter, setFilter] = useState<"all" | Status>("all");

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/transferts?limit=50")
      .then((r) => r.json())
      .then((data: { items?: Transfert[] }) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setFetching(false));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const filtered = filter === "all" ? items : items.filter((t) => t.status === filter);

  return (
    <DashboardShell
      title="Historique"
      subtitle={`${items.length} transfert${items.length > 1 ? "s" : ""} au total`}
    >
      <div style={{ display: "grid", gap: 16, maxWidth: 980 }}>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`pill ${filter === s ? "primary" : ""}`}
              style={{
                cursor: "pointer",
                border: "1px solid var(--border)",
                background: filter === s ? "var(--primary)" : "var(--bg-elevated)",
                color: filter === s ? "var(--bg-base)" : "var(--text-secondary)",
                padding: "6px 12px",
                fontSize: 12,
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
              {filter === "all"
                ? "Aucun transfert pour le moment. Lancez votre premier envoi !"
                : "Aucun transfert dans cette catégorie."}
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {filtered.map((t) => {
              const color = STATUS_COLOR[t.status];
              return (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr auto",
                    gap: 14,
                    alignItems: "center",
                    padding: 14,
                    borderRadius: 12,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {t.beneficiaire?.full_name ?? "—"}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {t.beneficiaire?.phone}
                      {t.beneficiaire?.operator ? ` · ${t.beneficiaire.operator.toUpperCase()}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {t.amount_eur.toFixed(2)} EUR
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      → {t.amount_xof.toLocaleString("fr-FR")} XOF
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                    Frais : {t.fee_eur.toFixed(2)} €
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
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", textAlign: "right" }}>
                    {new Date(t.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
