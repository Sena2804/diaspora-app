"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";
import { Lock } from "lucide-react";

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

// The receiver can only withdraw once the sender has confirmed the Stellar
// payment. Earlier statuses show as "waiting for sender".
const WITHDRAWABLE: Status[] = ["stellar_received"];

export default function WalletPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const { confirmWithPin } = usePinConfirm();
  const [items, setItems] = useState<IncomingTransfert[]>([]);
  const [fetching, setFetching] = useState(true);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const [noPhoneWarning, setNoPhoneWarning] = useState(false);
  const toast = useToast();
  // Le retrait n'est autorisé que si le téléphone est vérifié — sinon on ne
  // sait pas où envoyer l'argent, et c'est ce que le mentor demandait
  // (compte verrouillé en réception tant que le numéro n'est pas validé).
  const canReceive = !!user?.phone && !!user?.phoneVerified;

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
      toast.error("Impossible de charger vos transferts.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Live polling: while at least one transfert is mid-flight (momo_initiated),
  // re-fetch /api/inbox every 3 seconds so the receiver sees the status flip
  // to "completed" without manual refresh.
  useEffect(() => {
    const hasInFlight = items.some((t) => t.status === "momo_initiated");
    if (!hasInFlight) return;
    const id = window.setInterval(() => {
      refresh();
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

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
      title={`Bonjour ${user?.email.split("@")[0] ?? ""}`}
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
            ⚠️ Votre numéro Mobile Money n&apo;est pas encore enregistré.{" "}
            <a href="/settings" style={{ color: "inherit", textDecoration: "underline" }}>
              Ajoutez-le dans Paramètres
            </a>{" "}
            pour relier votre compte aux transferts qu&apo;on vous envoie.
          </div>
        )}

        {/* --- Incoming transfers --- */}
        <section>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>
            Transferts entrants
          </h3>

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
                          onClick={() => withdraw(t.id, Number(t.amount_xof))}
                          disabled={withdrawing === t.id || !canReceive}
                          title={!canReceive ? "Vérifie ton téléphone pour retirer" : undefined}
                          style={{ fontSize: 12, padding: "6px 14px", opacity: canReceive ? 1 : 0.55 }}
                        >
                          {withdrawing === t.id ? (
                            <><Spinner size={12} />Retrait…</>
                          ) : !canReceive ? (
                            <><Lock size={12} />Téléphone non vérifié</>
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
