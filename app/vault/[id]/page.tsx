"use client";

import React, { useEffect, useMemo, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Wallet,
  Zap,
  SkipForward,
  Download,
  PauseCircle,
  PlayCircle,
  Trash2,
  Target,
  CalendarClock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  X,
  PiggyBank,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";

type Status = "active" | "paused" | "reached" | "withdrawn";
type ContribKind = "manual" | "scheduled" | "skip" | "withdrawal";

interface Vault {
  id: string;
  name: string;
  goal_xof: number;
  target_date: string | null;
  monthly_amount_xof: number;
  day_of_month: number;
  next_charge_at: string;
  last_charge_at: string | null;
  balance_xof: number;
  debt_xof: number;
  status: Status;
  created_at: string;
  withdrawn_at: string | null;
}

interface Contribution {
  id: string;
  amount_xof: number;
  kind: ContribKind;
  note: string | null;
  occurred_at: string;
}

interface VaultDetailResponse {
  vault: Vault;
  contributions: Contribution[];
}

const KIND_LABEL: Record<ContribKind, string> = {
  manual: "Ajout manuel",
  scheduled: "Échéance confirmée",
  skip: "Échéance sautée",
  withdrawal: "Retrait",
};

const KIND_COLOR: Record<ContribKind, string> = {
  manual: "#15803d",
  scheduled: "#0d9488",
  skip: "#b45309",
  withdrawal: "#6b7280",
};

function formatRelative(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  let label: string;
  if (abs < 60_000) label = "moins d'une minute";
  else if (minutes < 60) label = `${minutes} min`;
  else if (hours < 48) label = `${hours} h`;
  else label = `${days} j`;
  return diff < 0 ? `il y a ${label}` : `dans ${label}`;
}

export default function VaultDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [vault, setVault] = useState<Vault | null>(null);
  const [contribs, setContribs] = useState<Contribution[]>([]);
  const [fetching, setFetching] = useState(true);
  const [busy, setBusy] = useState(false);
  const [contribOpen, setContribOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    try {
      const res = await fetch(`/api/vaults/${id}`);
      const data = (await res.json()) as VaultDetailResponse | { error?: { message: string } };
      if ("error" in data && data.error) {
        toast.error(data.error.message);
        router.push("/vault");
        return;
      }
      const ok = data as VaultDetailResponse;
      setVault(ok.vault);
      setContribs(ok.contributions);
    } catch {
      toast.error("Impossible de charger la caisse.");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh().finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const computed = useMemo(() => {
    if (!vault) return null;
    const balance = Number(vault.balance_xof);
    const goal = Number(vault.goal_xof);
    const pct = Math.max(0, Math.min(100, (balance / goal) * 100));
    const isDue = vault.status === "active" && new Date(vault.next_charge_at).getTime() <= Date.now();
    const remaining = Math.max(0, goal - balance);
    // L'objectif est considéré atteint si le statut est 'reached' (auto-bascule
    // côté API) OU si le solde dépasse l'objectif (cas de bord avant refresh).
    const reached = vault.status === "reached" || balance >= goal;
    return { balance, goal, pct, isDue, remaining, reached };
  }, [vault]);

  if (loading || !isAuthenticated) return null;
  if (fetching || !vault || !computed) {
    return (
      <DashboardShell title="Caisse" subtitle="Chargement…">
        <div style={{ padding: 40, textAlign: "center" }}><Spinner size={20} /></div>
      </DashboardShell>
    );
  }

  async function confirmDue() {
    if (!vault) return;
    const ok = await confirmWithPin({
      title: "Confirmer le prélèvement",
      subtitle: `Prélèvement de ${Number(vault.monthly_amount_xof).toLocaleString("fr-FR")} XOF${Number(vault.debt_xof) > 0 ? ` + dette ${Number(vault.debt_xof).toLocaleString("fr-FR")}` : ""} vers ta caisse.`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vaults/${id}/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success(`+${Number(data.credited_xof).toLocaleString("fr-FR")} XOF ajoutés à ta caisse.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function skipDue() {
    if (!vault) return;
    if (!confirm(`Sauter cette échéance ? La dette de ta caisse augmentera de ${Number(vault.monthly_amount_xof).toLocaleString("fr-FR")} XOF.`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vaults/${id}/skip`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.info("Échéance sautée — dette enregistrée.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!vault) return;
    const ok = await confirmWithPin({
      title: "Retirer ton épargne",
      subtitle: `Tu retires ${computed!.balance.toLocaleString("fr-FR")} XOF. Cela clôture définitivement la caisse.`,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vaults/${id}/withdraw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success(`${Number(data.withdrawn_xof).toLocaleString("fr-FR")} XOF retirés. Caisse clôturée.`);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!vault) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vaults/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: vault.status === "active" ? "paused" : "active" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success(vault.status === "active" ? "Caisse mise en pause." : "Caisse réactivée.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!vault) return;
    if (!confirm(`Supprimer définitivement la caisse « ${vault.name} » et tout son historique ?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/vaults/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success("Caisse supprimée.");
      router.push("/vault");
    } finally {
      setBusy(false);
    }
  }

  const isWithdrawn = vault.status === "withdrawn";
  const isPaused = vault.status === "paused";
  const isReached = vault.status === "reached" || computed.reached;

  return (
    <DashboardShell
      title={vault.name}
      subtitle={
        isWithdrawn
          ? "Caisse clôturée."
          : isReached
            ? "Objectif atteint — prélèvements stoppés, tu peux retirer ton épargne quand tu veux."
            : `Encore ${computed.remaining.toLocaleString("fr-FR")} XOF à épargner pour atteindre ton objectif.`
      }
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        <Link href="/vault" className="btn btn-ghost" style={{ alignSelf: "flex-start", fontSize: 12 }}>
          <ArrowLeft size={12} />
          Toutes mes caisses
        </Link>

        {/* Carte principale : barre de progression + solde */}
        <section
          style={{
            padding: 24,
            borderRadius: 16,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-base))",
            border: `1px solid ${isReached && !isWithdrawn ? "var(--primary)" : "var(--border-subtle)"}`,
            boxShadow: isReached && !isWithdrawn ? "0 0 0 3px var(--primary-soft)" : "none",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
            <div>
              <span className="eyebrow" style={{ marginBottom: 6 }}>Solde courant</span>
              <div className="mono" style={{ fontSize: 42, fontWeight: 700, color: computed.balance < 0 ? "#b91c1c" : "var(--primary)", lineHeight: 1 }}>
                {computed.balance.toLocaleString("fr-FR")}
                <span style={{ fontSize: 16, marginLeft: 8, color: "var(--text-secondary)" }}>XOF</span>
              </div>
              {computed.balance < 0 && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#b91c1c", display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <AlertCircle size={12} />
                  Solde négatif — ta caisse te doit
                </div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Objectif</div>
              <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                {Number(vault.goal_xof).toLocaleString("fr-FR")} XOF
              </div>
              {vault.target_date && (
                <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                  Avant le {new Date(vault.target_date).toLocaleDateString("fr-FR")}
                </div>
              )}
            </div>
          </div>

          <div style={{ height: 10, borderRadius: 999, background: "var(--bg-base)", overflow: "hidden", marginBottom: 6 }}>
            <div
              style={{
                width: `${computed.pct}%`,
                height: "100%",
                background: isReached ? "var(--primary)" : "linear-gradient(90deg, var(--primary), var(--primary-strong))",
                transition: "width 0.4s",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)" }}>
            <span>{computed.pct.toFixed(0)} % de l&apos;objectif</span>
            <span className="mono">{Number(vault.monthly_amount_xof).toLocaleString("fr-FR")} XOF / mois · le {vault.day_of_month}</span>
          </div>

          {Number(vault.debt_xof) > 0 && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#b91c1c", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertCircle size={14} />
              <span>
                <strong>Dette accumulée : {Number(vault.debt_xof).toLocaleString("fr-FR")} XOF</strong>
                <div style={{ fontSize: 11, opacity: 0.85 }}>Sera rattrapée au prochain prélèvement confirmé.</div>
              </span>
            </div>
          )}
        </section>

        {/* Bannière objectif atteint */}
        {isReached && !isWithdrawn && (
          <section
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(45,212,191,0.12)",
              border: "1px solid var(--primary)",
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <CheckCircle2 size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>Objectif atteint — fonds débloqués</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                Les prélèvements automatiques sont stoppés. Tu peux retirer ton épargne quand tu veux.
              </div>
            </div>
          </section>
        )}

        {/* Actions principales */}
        {!isWithdrawn && (
          <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
            {isReached && (
              <button
                className="btn btn-primary"
                onClick={withdraw}
                disabled={busy}
                style={{ padding: 14, fontSize: 13 }}
              >
                {busy ? <Spinner size={14} /> : <Download size={14} />}
                Retirer mon épargne
              </button>
            )}

            {computed.isDue && !isReached && (
              <button
                className="btn btn-primary"
                onClick={confirmDue}
                disabled={busy}
                style={{ padding: 14, fontSize: 13 }}
              >
                {busy ? <Spinner size={14} /> : <Zap size={14} />}
                Confirmer le prélèvement
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => setContribOpen(true)}
              disabled={busy || isPaused}
              style={{ padding: 14, fontSize: 13 }}
              title={isPaused ? "Réactive la caisse pour ajouter de l'argent" : undefined}
            >
              <Plus size={14} />
              Ajouter de l&apos;argent
            </button>

            {!isReached && !computed.isDue && vault.status === "active" && (
              <button
                className="btn btn-ghost"
                onClick={confirmDue}
                disabled={busy}
                style={{ padding: 14, fontSize: 12 }}
                title="Forcer le prélèvement maintenant (utile pour la démo)"
              >
                <Zap size={14} />
                Simuler échéance
              </button>
            )}
          </section>
        )}

        {/* Info ligne : prochaine échéance + actions secondaires.
            Masquée quand l'objectif est atteint : plus de prélèvement à venir. */}
        {!isWithdrawn && !isReached && (
          <section style={{ padding: 14, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <CalendarClock size={16} color={computed.isDue ? "var(--primary)" : "var(--text-tertiary)"} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>
                  {isPaused
                    ? "Caisse en pause"
                    : computed.isDue
                      ? "Échéance prête à confirmer"
                      : `Prochaine échéance ${formatRelative(vault.next_charge_at)}`}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {new Date(vault.next_charge_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {computed.isDue && (
                <button className="btn btn-ghost" onClick={skipDue} disabled={busy} style={{ fontSize: 11, padding: "6px 10px" }}>
                  <SkipForward size={11} />
                  Sauter
                </button>
              )}
              <button className="btn btn-ghost" onClick={togglePause} disabled={busy} style={{ fontSize: 11, padding: "6px 10px" }}>
                {vault.status === "active" ? <PauseCircle size={11} /> : <PlayCircle size={11} />}
                {vault.status === "active" ? "Pause" : "Activer"}
              </button>
              <button className="btn btn-ghost" onClick={remove} disabled={busy} style={{ fontSize: 11, padding: "6px 10px" }}>
                <Trash2 size={11} />
              </button>
            </div>
          </section>
        )}

        {/* Quand l'objectif est atteint, on garde uniquement le bouton Supprimer
            au cas où l'utilisateur veut nettoyer sans retirer. */}
        {isReached && !isWithdrawn && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn btn-ghost" onClick={remove} disabled={busy} style={{ fontSize: 11, padding: "6px 12px" }}>
              <Trash2 size={11} />
              Supprimer cette caisse
            </button>
          </div>
        )}

        {/* Historique */}
        <section>
          <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 10px" }}>Historique</h3>
          {contribs.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 10, color: "var(--text-tertiary)", fontSize: 12 }}>
              Aucun mouvement pour le moment.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {contribs.map((c) => {
                const amount = Number(c.amount_xof);
                const isPositive = amount > 0;
                const isNeutral = amount === 0;
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: 12,
                      borderRadius: 10,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: `${KIND_COLOR[c.kind]}1f` }}>
                      {c.kind === "manual" ? <Plus size={13} color={KIND_COLOR[c.kind]} /> :
                       c.kind === "scheduled" ? <Zap size={13} color={KIND_COLOR[c.kind]} /> :
                       c.kind === "skip" ? <SkipForward size={13} color={KIND_COLOR[c.kind]} /> :
                       <Download size={13} color={KIND_COLOR[c.kind]} />}
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{KIND_LABEL[c.kind]}</div>
                      {c.note && (
                        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{c.note}</div>
                      )}
                      <div style={{ fontSize: 10, color: "var(--text-tertiary)", marginTop: 2 }}>
                        {new Date(c.occurred_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: isNeutral ? "var(--text-tertiary)" : isPositive ? "#15803d" : "#b91c1c" }}>
                      {isNeutral ? "—" : (isPositive ? "+" : "") + amount.toLocaleString("fr-FR")} XOF
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {contribOpen && (
        <ContributeModal
          vaultId={vault.id}
          onClose={() => setContribOpen(false)}
          onDone={async () => {
            setContribOpen(false);
            await refresh();
          }}
        />
      )}
    </DashboardShell>
  );
}

function ContributeModal({ vaultId, onClose, onDone }: { vaultId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Montant invalide.");
      return;
    }

    const ok = await confirmWithPin({
      title: "Ajouter à ma caisse",
      subtitle: `Tu ajoutes ${amt.toLocaleString("fr-FR")} XOF à ta caisse.`,
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/vaults/${vaultId}/contribute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount_xof: Math.round(amt), note: note.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success(`+${amt.toLocaleString("fr-FR")} XOF ajoutés.`);
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(2,6,14,0.65)",
        display: "grid",
        placeItems: "center",
        zIndex: 80,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-elevated)",
          borderRadius: 16,
          padding: 24,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Ajouter de l&apos;argent à ma caisse</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 16px" }}>
          Pour mettre plus que la mensualité, ou rattraper du retard.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div className="field">
            <label>Montant (XOF)</label>
            <div className="input">
              <PiggyBank style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
              <input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Montant libre"
                autoFocus
                required
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>XOF</span>
            </div>
            <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              Aucune limite — ajoute ce que tu veux, même de petites sommes.
            </span>
          </div>

          <div className="field">
            <label>Note <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optionnel)</span></label>
            <div className="input">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 120))}
                placeholder="Bonus, économie de la semaine…"
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? <><Spinner size={14} />Ajout…</> : <><ShieldCheck size={14} />Ajouter (PIN requis)</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
