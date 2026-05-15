"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  PiggyBank,
  ArrowRight,
  Target,
  CalendarClock,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";

type Status = "active" | "paused" | "reached" | "withdrawn";

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

const STATUS_LABEL: Record<Status, string> = {
  active: "Active",
  paused: "En pause",
  reached: "Objectif atteint",
  withdrawn: "Clôturée",
};

const STATUS_COLOR: Record<Status, { bg: string; fg: string }> = {
  active: { bg: "rgba(34,197,94,0.16)", fg: "#15803d" },
  paused: { bg: "rgba(251,191,36,0.16)", fg: "#b45309" },
  reached: { bg: "rgba(45,212,191,0.2)", fg: "#0d9488" },
  withdrawn: { bg: "rgba(107,114,128,0.12)", fg: "#6b7280" },
};

export default function VaultsListPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<Vault[]>([]);
  const [fetching, setFetching] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    try {
      const res = await fetch("/api/vaults");
      const data = (await res.json()) as { items?: Vault[] };
      setItems(data.items ?? []);
    } catch {
      toast.error("Impossible de charger les caisses.");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh().finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const active = items.filter((v) => v.status === "active");
  const totalSaved = items
    .filter((v) => v.status !== "withdrawn")
    .reduce((acc, v) => acc + Math.max(0, Number(v.balance_xof)), 0);

  return (
    <DashboardShell
      title="Mes caisses"
      subtitle="Épargne pour un objectif : voyage, projet, école… L'app prélève chaque mois et tu confirmes."
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 880 }}>
        <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          <Stat label="Caisses actives" value={active.length} accent="primary" />
          <Stat label="Total épargné" value={`${totalSaved.toLocaleString("fr-FR")} XOF`} small />
          <Stat label="Caisses clôturées" value={items.filter((v) => v.status === "withdrawn").length} />
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Mes caisses</h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
              Tu choisis le montant mensuel et le jour de prélèvement. L&apos;app te notifie à chaque échéance.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Nouvelle caisse
          </button>
        </div>

        {fetching ? (
          <SkeletonRows count={3} />
        ) : items.length === 0 ? (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              border: "1px dashed var(--border)",
              borderRadius: 12,
              color: "var(--text-tertiary)",
              fontSize: 13,
            }}
          >
            <PiggyBank size={28} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
              Aucune caisse pour le moment
            </div>
            <div>Crée ta première caisse pour épargner vers un objectif.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((v) => {
              const balance = Number(v.balance_xof);
              const goal = Number(v.goal_xof);
              const debt = Number(v.debt_xof);
              const pct = Math.max(0, Math.min(100, (balance / goal) * 100));
              const reached = balance >= goal;
              const color = STATUS_COLOR[v.status];
              return (
                <Link
                  key={v.id}
                  href={`/vault/${v.id}`}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "var(--bg-elevated)",
                    border: `1px solid ${v.status === "reached" ? "var(--primary)" : "var(--border-subtle)"}`,
                    boxShadow: v.status === "reached" ? "0 0 0 3px var(--primary-soft)" : "none",
                    textDecoration: "none",
                    color: "inherit",
                    display: "grid",
                    gap: 12,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <PiggyBank size={16} color="var(--primary)" />
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{v.name}</span>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: 999,
                            fontSize: 10,
                            fontWeight: 600,
                            background: color.bg,
                            color: color.fg,
                          }}
                        >
                          {STATUS_LABEL[v.status]}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", display: "flex", flexWrap: "wrap", gap: 12 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Target size={11} />
                          Objectif {goal.toLocaleString("fr-FR")} XOF
                        </span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CalendarClock size={11} />
                          {Number(v.monthly_amount_xof).toLocaleString("fr-FR")} XOF le {v.day_of_month} du mois
                        </span>
                      </div>
                    </div>
                    <ArrowRight size={16} color="var(--text-tertiary)" />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: balance < 0 ? "#b91c1c" : "var(--text-primary)" }}>
                        {balance.toLocaleString("fr-FR")} XOF
                      </span>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{pct.toFixed(0)} %</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: "var(--bg-base)", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background: reached ? "var(--primary)" : "linear-gradient(90deg, var(--primary), var(--primary-strong))",
                          transition: "width 0.4s",
                        }}
                      />
                    </div>
                    {(debt > 0 || balance < 0) && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "#b91c1c", display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <AlertCircle size={11} />
                        {debt > 0 ? `Dette : ${debt.toLocaleString("fr-FR")} XOF` : `Solde négatif`}
                      </div>
                    )}
                    {v.status === "reached" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: "var(--primary)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={11} />
                        Objectif atteint — tu peux retirer
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateVaultModal
          onClose={() => setCreateOpen(false)}
          onCreated={async (id) => {
            setCreateOpen(false);
            await refresh();
            router.push(`/vault/${id}`);
          }}
        />
      )}
    </DashboardShell>
  );
}

function Stat({ label, value, accent, small }: { label: string; value: string | number; accent?: "primary"; small?: boolean }) {
  const color = accent === "primary" ? "var(--primary)" : "var(--text-primary)";
  return (
    <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="mono" style={{ fontSize: small ? 16 : 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function CreateVaultModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [monthly, setMonthly] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const goalNum = Number(goal);
    const monthlyNum = Number(monthly);
    if (!name.trim()) return toast.error("Nom de caisse requis.");
    if (!goalNum || goalNum <= 0) return toast.error("Objectif XOF invalide.");
    if (!monthlyNum || monthlyNum <= 0) return toast.error("Montant mensuel invalide.");
    if (monthlyNum > goalNum) return toast.error("La mensualité ne peut pas dépasser l'objectif.");

    const ok = await confirmWithPin({
      title: "Créer ta caisse",
      subtitle: `« ${name.trim()} » — ${monthlyNum.toLocaleString("fr-FR")} XOF le ${dayOfMonth} de chaque mois.`,
    });
    if (!ok) {
      toast.info("Création annulée.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        goal_xof: Math.round(goalNum),
        monthly_amount_xof: Math.round(monthlyNum),
        day_of_month: dayOfMonth,
      };
      if (targetDate) payload.target_date = targetDate;
      const res = await fetch("/api/vaults", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la création.");
        return;
      }
      toast.success(`Caisse « ${data.name} » créée.`);
      onCreated(data.id);
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
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--bg-elevated)",
          borderRadius: 16,
          padding: 24,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouvelle caisse</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-tertiary)", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 18px" }}>
          Donne-toi un objectif et un montant à mettre de côté chaque mois. Tu peux aussi ajouter de l&apos;argent à tout moment.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div className="field">
            <label>Nom de la caisse</label>
            <div className="input">
              <PiggyBank style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 80))}
                placeholder="Voyage Cotonou, Mariage Aïssatou…"
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Objectif (XOF)</label>
            <div className="input">
              <Target style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
              <input
                type="number"
                min="1000"
                step="1000"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="500000"
                required
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>XOF</span>
            </div>
          </div>

          <div className="field">
            <label>Montant prélevé chaque mois (XOF)</label>
            <div className="input">
              <input
                type="number"
                min="500"
                step="500"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
                placeholder="50000"
                required
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>XOF</span>
            </div>
          </div>

          <div className="field">
            <label>Jour du prélèvement</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayOfMonth(d)}
                  className={dayOfMonth === d ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ fontSize: 11, padding: "6px 2px", minWidth: 0 }}
                >
                  {d}
                </button>
              ))}
            </div>
            <span className="dim" style={{ fontSize: 11, marginTop: 6, display: "block" }}>
              Le {dayOfMonth} de chaque mois (si le mois est plus court, on prend le dernier jour).
            </span>
          </div>

          <div className="field">
            <label>Date cible <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optionnel)</span></label>
            <div className="input">
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
              On t&apos;affichera un rappel si tu n&apos;es pas dans les temps.
            </span>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting}>
              {submitting ? <><Spinner size={14} />Création…</> : <><ShieldCheck size={14} />Créer (PIN requis)</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
