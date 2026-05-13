"use client";

import { useEffect, useState } from "react";
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

interface Transfert {
  id: string;
  amount_eur: number;
  status: Status;
  stellar_tx_hash: string | null;
  soroban_tx_hash: string | null;
  created_at: string;
  beneficiaire: { full_name: string } | null;
}

const PLATFORM_PUBLIC = "GBUSNTA27ZEVHRPZB2IAPGSSFFPRR7WCYXTEPUPSWHLUTZH64WQCNTMY";
const EXPLORER = "https://stellar.expert/explorer/testnet";

export default function BlockchainPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<Transfert[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/transferts?limit=50")
      .then((r) => r.json())
      .then((data: { items?: Transfert[] }) => setItems(data.items ?? []))
      .finally(() => setFetching(false));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const withTx = items.filter((t) => t.stellar_tx_hash || t.soroban_tx_hash);

  return (
    <DashboardShell
      title="Preuves blockchain"
      subtitle="Toutes vos transactions sont enregistrées de manière vérifiable sur Stellar."
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>Wallet plateforme</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 14px" }}>
            Adresse Stellar testnet qui séquestre les USDC entre la diaspora et le payout MoMo.
          </p>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span className="mono" style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "var(--bg-base)", wordBreak: "break-all", flex: 1 }}>
              {PLATFORM_PUBLIC}
            </span>
            <a
              className="btn btn-ghost"
              href={`${EXPLORER}/account/${PLATFORM_PUBLIC}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Voir sur Stellar Explorer ↗
            </a>
          </div>
        </section>

        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Mes transactions on-chain</h3>

          {fetching ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Chargement…
            </div>
          ) : withTx.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Aucune preuve on-chain pour le moment. Elles apparaîtront ici dès que vos transferts seront signés.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {withTx.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr auto",
                    gap: 14,
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 10,
                    background: "var(--bg-base)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{t.beneficiaire?.full_name ?? "—"}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {t.stellar_tx_hash
                        ? `${t.stellar_tx_hash.slice(0, 10)}…${t.stellar_tx_hash.slice(-6)}`
                        : "Pas encore signé"}
                    </div>
                  </div>
                  <div className="mono" style={{ fontSize: 13 }}>€{t.amount_eur.toFixed(2)}</div>
                  <a
                    className="btn btn-ghost"
                    href={t.stellar_tx_hash ? `${EXPLORER}/tx/${t.stellar_tx_hash}` : "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ pointerEvents: t.stellar_tx_hash ? "auto" : "none", opacity: t.stellar_tx_hash ? 1 : 0.4 }}
                  >
                    Vérifier ↗
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
