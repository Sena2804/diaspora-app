"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
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

interface SenderInfo {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  wallet_id: string | null;
  country: string | null;
}

interface IncomingTransfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: Status;
  motif: string | null;
  created_at: string;
  completed_at: string | null;
  sender: SenderInfo | null;
}

interface InboxResponse {
  items: IncomingTransfert[];
  can_withdraw: boolean;
  recipient_phone: string | null;
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

const WITHDRAWABLE: Status[] = ["stellar_received"];

export default function WalletPage() {
  // ─── HOOKS — ordre stable, AUCUN appel conditionnel ───
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const { confirmWithPin } = usePinConfirm();
  const toast = useToast();
  const [items, setItems] = useState<IncomingTransfert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [canWithdraw, setCanWithdraw] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let aborted = false;
    const load = async () => {
      setFetching(true);
      try {
        const res = await fetch("/api/inbox");
        const data = (await res.json()) as InboxResponse;
        if (aborted) return;
        setItems(data.items ?? []);
        setCanWithdraw(!!data.can_withdraw);
      } catch {
        if (!aborted) toast.error("Impossible de charger vos transferts.");
      } finally {
        if (!aborted) setFetching(false);
      }
    };
    load();
    return () => {
      aborted = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Polling discret tant qu'un retrait est en vol (momo_initiated).
  useEffect(() => {
    const hasInFlight = items.some((t) => t.status === "momo_initiated");
    if (!hasInFlight) return;
    const id = window.setInterval(async () => {
      try {
        const res = await fetch("/api/inbox");
        const data = (await res.json()) as InboxResponse;
        setItems(data.items ?? []);
        setCanWithdraw(!!data.can_withdraw);
      } catch {
        /* silent */
      }
    }, 3000);
    return () => window.clearInterval(id);
  }, [items]);

  const stats = useMemo(() => {
    const pending = items.filter((t) => WITHDRAWABLE.includes(t.status));
    const completed = items.filter((t) => t.status === "completed");
    return {
      pendingXof: pending.reduce((acc, t) => acc + Number(t.amount_xof), 0),
      pendingCount: pending.length,
      totalReceived: completed.reduce((acc, t) => acc + Number(t.amount_xof), 0),
    };
  }, [items]);

  // ─── End hooks ─── Early return SAFE ici, toutes les hooks au-dessus.
  if (loading || !isAuthenticated) return null;

  async function refresh() {
    try {
      const res = await fetch("/api/inbox");
      const data = (await res.json()) as InboxResponse;
      setItems(data.items ?? []);
      setCanWithdraw(!!data.can_withdraw);
    } catch {
      /* silent */
    }
  }

  async function withdraw(id: string, amountXof: number) {
    const ok = await confirmWithPin({
      title: "Confirme le retrait",
      subtitle: `Tu vas retirer ${amountXof.toLocaleString("fr-FR")} XOF sur ton compte Mobile Money.`,
    });
    if (!ok) {
      toast.info("Retrait annulé.");
      return;
    }
    setWithdrawing(id);
    try {
      const res = await fetch(`/api/withdrawals/${id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec du retrait.");
        return;
      }
      toast.success("Retrait initié. Notification MoMo dans quelques secondes.");
      await refresh();
    } finally {
      setWithdrawing(null);
    }
  }

  return (
    <DashboardShell
      title="Mon portefeuille"
      subtitle={
        !canWithdraw
          ? "Vérifie ton numéro Mobile Money pour pouvoir retirer."
          : stats.pendingCount > 0
            ? `Tu as ${stats.pendingXof.toLocaleString("fr-FR")} XOF prêts à retirer.`
            : "Tout est à jour. Aucun retrait en attente."
      }
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        {/* Balance card */}
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

        {/* Banner si retrait verrouillé */}
        {!canWithdraw && (
          <div
            style={{
              padding: 14,
              borderRadius: 12,
              background: "rgba(251,191,36,0.12)",
              border: "1px solid rgba(251,191,36,0.3)",
              color: "#b45309",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Lock size={18} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>Retrait verrouillé</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>
                Ton numéro Mobile Money n&apos;est pas encore vérifié.{" "}
                <a href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>
                  Vérifie-le dans Paramètres
                </a>{" "}
                pour pouvoir retirer.
              </div>
            </div>
          </div>
        )}

        {/* Liste des transferts entrants */}
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Transferts entrants</h3>

          {fetching ? (
            <SkeletonRows count={3} />
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
              Aucun transfert pour le moment. Partage ton identifiant DiasporaConnect pour qu&apos;on te fasse un cadeau.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {items.map((t) => {
                const c = STATUS_COLOR[t.status];
                const isWithdrawable = WITHDRAWABLE.includes(t.status);
                const senderName =
                  t.sender?.full_name ||
                  [t.sender?.first_name, t.sender?.last_name].filter(Boolean).join(" ") ||
                  t.sender?.email ||
                  "Expéditeur";
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
                      {t.sender?.wallet_id && (
                        <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                          {t.sender.wallet_id}
                        </div>
                      )}
                      {t.motif && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2, fontStyle: "italic" }}>
                          « {t.motif} »
                        </div>
                      )}
                      <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
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
                      {isWithdrawable && (
                        <button
                          className="btn btn-primary"
                          onClick={() => withdraw(t.id, Number(t.amount_xof))}
                          disabled={withdrawing === t.id || !canWithdraw}
                          title={!canWithdraw ? "Vérifie ton téléphone pour retirer" : undefined}
                          style={{ fontSize: 12, padding: "6px 14px", opacity: canWithdraw ? 1 : 0.55 }}
                        >
                          {withdrawing === t.id ? (
                            <>
                              <Spinner size={12} />
                              Retrait…
                            </>
                          ) : !canWithdraw ? (
                            <>
                              <Lock size={12} />
                              Verrouillé
                            </>
                          ) : (
                            "Retirer sur MoMo"
                          )}
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
