"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  CalendarClock,
  PlayCircle,
  PauseCircle,
  Trash2,
  Zap,
  AtSign,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
} from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";
import { WEEKDAYS_FR, formatSchedule, type Frequency } from "@/lib/recurring";

interface RecurringRecipient {
  wallet_id: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  kyc_verified: boolean;
}

interface Recurring {
  id: string;
  recipient_wallet_id: string;
  recipient_id: string | null;
  amount_eur: number;
  motif: string | null;
  frequency: Frequency;
  day_of_period: number;
  next_run_at: string;
  last_run_at: string | null;
  active: boolean;
  total_runs: number;
  created_at: string;
  recipient: RecurringRecipient | null;
}

interface LookupResponse {
  wallet_id: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  kyc_status: "pending" | "verified" | "rejected" | null;
  can_receive: boolean;
  is_self: boolean;
}

const WALLET_ID_REGEX = /^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;

function recipientName(rec: RecurringRecipient | null, fallback: string): string {
  if (!rec) return fallback;
  const name = [rec.first_name, rec.last_name].filter(Boolean).join(" ");
  return name || fallback;
}

function formatRelativeTime(iso: string): string {
  const now = Date.now();
  const target = new Date(iso).getTime();
  const diffMs = target - now;
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);
  let label: string;
  if (absMs < 60_000) label = "moins d'une minute";
  else if (minutes < 60) label = `${minutes} min`;
  else if (hours < 24) label = `${hours} h`;
  else label = `${days} j`;
  return diffMs < 0 ? `il y a ${label}` : `dans ${label}`;
}

export default function RecurringPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [items, setItems] = useState<Recurring[]>([]);
  const [fetching, setFetching] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    try {
      const res = await fetch("/api/recurring");
      const data = (await res.json()) as { items?: Recurring[] };
      setItems(data.items ?? []);
    } catch {
      toast.error("Impossible de charger les programmations.");
    }
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    refresh().finally(() => setFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // Re-render toutes les 30s pour rafraîchir les "dans X min".
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const stats = useMemo(() => {
    const active = items.filter((r) => r.active);
    return {
      active: active.length,
      paused: items.length - active.length,
      due: active.filter((r) => new Date(r.next_run_at).getTime() <= Date.now()).length,
      totalRuns: items.reduce((acc, r) => acc + r.total_runs, 0),
    };
    // tick force le recalcul des "due"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, tick]);

  if (loading || !isAuthenticated) return null;

  async function toggleActive(rec: Recurring) {
    setBusyId(rec.id);
    try {
      const res = await fetch(`/api/recurring/${rec.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !rec.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec.");
        return;
      }
      toast.success(rec.active ? "Programmation mise en pause." : "Programmation réactivée.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(rec: Recurring) {
    if (!confirm(`Supprimer la programmation vers ${rec.recipient_wallet_id} ?`)) return;
    setBusyId(rec.id);
    try {
      const res = await fetch(`/api/recurring/${rec.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.error?.message ?? "Échec de la suppression.");
        return;
      }
      toast.success("Programmation supprimée.");
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function trigger(rec: Recurring) {
    const target = recipientName(rec.recipient, rec.recipient_wallet_id);
    const ok = await confirmWithPin({
      title: "Confirmer l'envoi récurrent",
      subtitle: `Tu vas envoyer ${rec.amount_eur.toFixed(2)} € à ${target}.`,
    });
    if (!ok) {
      toast.info("Envoi annulé.");
      return;
    }
    setBusyId(rec.id);
    try {
      const res = await fetch(`/api/recurring/${rec.id}/trigger`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de l'envoi.");
        return;
      }
      const target = recipientName(rec.recipient, rec.recipient_wallet_id);
      toast.success(`Envoi #${(data.recurring?.total_runs ?? rec.total_runs + 1)} confirmé — ${target} peut retirer maintenant.`);
      await refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <DashboardShell
      title="Envois récurrents"
      subtitle="Programme des envois qui se répètent, et confirme chaque échéance par notification."
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 880 }}>
        <section style={summaryStyle()}>
          <SummaryStat label="Programmations actives" value={stats.active} accent="primary" />
          <SummaryStat label="En pause" value={stats.paused} />
          <SummaryStat label="Échéances à confirmer" value={stats.due} accent={stats.due > 0 ? "warn" : undefined} />
          <SummaryStat label="Envois déjà déclenchés" value={stats.totalRuns} />
        </section>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Mes programmations</h2>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "2px 0 0" }}>
              À chaque échéance, on te demande ton PIN pour confirmer l&apos;envoi.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={14} />
            Nouvelle programmation
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
            <CalendarClock size={28} style={{ opacity: 0.5, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
              Aucune programmation
            </div>
            <div>Crée ta première programmation pour automatiser un envoi régulier.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {items.map((r) => {
              const isDue = r.active && new Date(r.next_run_at).getTime() <= Date.now();
              const target = recipientName(r.recipient, r.recipient_wallet_id);
              return (
                <article
                  key={r.id}
                  style={{
                    padding: 16,
                    borderRadius: 12,
                    background: "var(--bg-elevated)",
                    border: `1px solid ${isDue ? "var(--primary)" : "var(--border-subtle)"}`,
                    boxShadow: isDue ? "0 0 0 3px var(--primary-soft)" : "none",
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr auto",
                    gap: 14,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{target}</span>
                      {r.recipient?.kyc_verified && (
                        <span title="Identité vérifiée" style={{ display: "inline-flex" }}>
                          <ShieldCheck size={14} color="var(--primary)" />
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                      {r.recipient_wallet_id}
                    </div>
                    {r.motif && (
                      <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic", marginTop: 2 }}>
                        « {r.motif} »
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                      <CalendarClock size={11} />
                      {formatSchedule(r.frequency, r.day_of_period)} · {r.total_runs} envoi{r.total_runs > 1 ? "s" : ""} déclenché{r.total_runs > 1 ? "s" : ""}
                    </div>
                  </div>

                  <div>
                    <div className="mono" style={{ fontSize: 16, fontWeight: 600 }}>
                      {r.amount_eur.toFixed(2)} €
                    </div>
                    <div style={{ fontSize: 11, color: isDue ? "var(--primary)" : "var(--text-tertiary)", marginTop: 2, fontWeight: isDue ? 600 : 400 }}>
                      {!r.active ? "En pause" : isDue ? "Échéance prête !" : `Prochaine ${formatRelativeTime(r.next_run_at)}`}
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "stretch", minWidth: 170 }}>
                    {isDue && (
                      <button
                        className="btn btn-primary"
                        disabled={busyId === r.id}
                        onClick={() => trigger(r)}
                        style={{ fontSize: 12, padding: "8px 12px" }}
                      >
                        {busyId === r.id ? <><Spinner size={12} />Envoi…</> : <><Zap size={12} />Confirmer l&apos;envoi</>}
                      </button>
                    )}
                    {!isDue && r.active && (
                      <button
                        className="btn btn-ghost"
                        disabled={busyId === r.id}
                        onClick={() => trigger(r)}
                        title="Déclencher manuellement (utile pour la démo)"
                        style={{ fontSize: 11, padding: "6px 10px" }}
                      >
                        <Zap size={11} />Simuler échéance
                      </button>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        className="btn btn-ghost"
                        disabled={busyId === r.id}
                        onClick={() => toggleActive(r)}
                        style={{ fontSize: 11, padding: "6px 10px", flex: 1 }}
                        title={r.active ? "Mettre en pause" : "Réactiver"}
                      >
                        {r.active ? <PauseCircle size={12} /> : <PlayCircle size={12} />}
                        {r.active ? "Pause" : "Activer"}
                      </button>
                      <button
                        className="btn btn-ghost"
                        disabled={busyId === r.id}
                        onClick={() => remove(r)}
                        style={{ fontSize: 11, padding: "6px 10px" }}
                        title="Supprimer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateModal
          onClose={() => setCreateOpen(false)}
          onCreated={async () => {
            setCreateOpen(false);
            await refresh();
          }}
        />
      )}
    </DashboardShell>
  );
}

// ═══════════════════════════════════════════════════════════
// Composants internes
// ═══════════════════════════════════════════════════════════

function SummaryStat({ label, value, accent }: { label: string; value: number; accent?: "primary" | "warn" }) {
  const color =
    accent === "primary" ? "var(--primary)" :
    accent === "warn" ? "#b45309" :
    "var(--text-primary)";
  return (
    <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
      <div className="mono" style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function summaryStyle(): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 10,
  };
}

function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [walletId, setWalletId] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  // Par défaut : lundi pour weekly, le 1 pour monthly. Ajusté quand on
  // bascule de fréquence.
  const [dayOfPeriod, setDayOfPeriod] = useState<number>(1);
  const [motif, setMotif] = useState("");
  const [startNow, setStartNow] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [lookup, setLookup] = useState<LookupResponse | null>(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [lookupErr, setLookupErr] = useState<string | null>(null);

  // Clamp dayOfPeriod si on change de fréquence (un 12 en weekly n'a pas de sens).
  function changeFrequency(f: Frequency) {
    setFrequency(f);
    if (f === "weekly" && dayOfPeriod > 7) setDayOfPeriod(1);
  }

  async function doLookup() {
    const upper = walletId.trim().toUpperCase();
    if (!WALLET_ID_REGEX.test(upper)) {
      setLookupErr("Format invalide. Attendu : DC-XXXX-XXXX.");
      setLookup(null);
      return;
    }
    setLookingUp(true);
    setLookupErr(null);
    try {
      const res = await fetch(`/api/lookup?id=${encodeURIComponent(upper)}`);
      const data = await res.json();
      if (!res.ok) {
        setLookupErr(data?.error?.message ?? "Destinataire introuvable.");
        setLookup(null);
        return;
      }
      if ((data as LookupResponse).is_self) {
        setLookupErr("Tu ne peux pas te programmer un envoi à toi-même.");
        setLookup(null);
        return;
      }
      setLookup(data as LookupResponse);
    } catch {
      setLookupErr("Erreur réseau.");
    } finally {
      setLookingUp(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amt = Number(amount);
    if (!lookup) {
      toast.error("Vérifie d'abord l'identifiant du destinataire.");
      return;
    }
    if (!amt || amt <= 0) {
      toast.error("Saisis un montant valide.");
      return;
    }

    const schedule = formatSchedule(frequency, dayOfPeriod).toLowerCase();
    const ok = await confirmWithPin({
      title: "Créer la programmation",
      subtitle: `${amt.toFixed(2)} € ${schedule} vers ${lookup.first_name ?? lookup.wallet_id}.`,
    });
    if (!ok) {
      toast.info("Création annulée.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        recipient_wallet_id: lookup.wallet_id,
        amount_eur: amt,
        frequency,
        day_of_period: dayOfPeriod,
        start_now: startNow,
      };
      if (motif.trim()) payload.motif = motif.trim();
      const res = await fetch("/api/recurring", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la création.");
        return;
      }
      toast.success(startNow ? "Programmation créée. Première échéance dans quelques secondes." : "Programmation créée.");
      onCreated();
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
          background: "var(--bg-elevated)",
          borderRadius: 16,
          padding: 24,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nouvelle programmation</h2>
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
          On t&apos;enverra une notification à chaque échéance et tu confirmeras avec ton PIN.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <div className="field">
            <label>Identifiant du destinataire</label>
            <div className="input">
              <AtSign style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
              <input
                type="text"
                value={walletId}
                placeholder="DC-XXXX-XXXX"
                onChange={(e) => {
                  setWalletId(e.target.value.toUpperCase());
                  setLookup(null);
                  setLookupErr(null);
                }}
                onBlur={doLookup}
                style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.05em" }}
                required
              />
              {lookingUp && <Spinner size={12} />}
              {lookup && <CheckCircle2 size={14} color="#15803d" />}
            </div>
            {lookupErr && (
              <div style={{ color: "#b91c1c", fontSize: 11, marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                <AlertCircle size={11} />
                {lookupErr}
              </div>
            )}
            {lookup && (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                {recipientName(
                  { wallet_id: lookup.wallet_id, first_name: lookup.first_name, last_name: lookup.last_name, country: lookup.country, kyc_verified: lookup.kyc_status === "verified" },
                  lookup.wallet_id,
                )}{lookup.country ? ` · ${lookup.country}` : ""}
              </div>
            )}
          </div>

          <div className="field">
            <label>Montant (€)</label>
            <div className="input">
              <input
                type="number"
                step="0.01"
                min="1"
                max="10000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
                required
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>€</span>
            </div>
          </div>

          <div className="field">
            <label>Fréquence</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["weekly", "monthly"] as Frequency[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => changeFrequency(f)}
                  className={frequency === f ? "btn btn-primary" : "btn btn-ghost"}
                  style={{ fontSize: 12 }}
                >
                  {f === "weekly" ? "Chaque semaine" : "Chaque mois"}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>{frequency === "weekly" ? "Jour de la semaine" : "Jour du mois"}</label>
            {frequency === "weekly" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayOfPeriod(d)}
                    className={dayOfPeriod === d ? "btn btn-primary" : "btn btn-ghost"}
                    style={{ fontSize: 11, padding: "8px 4px" }}
                    title={WEEKDAYS_FR[d]}
                  >
                    {WEEKDAYS_FR[d].slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 4 }}>
                {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDayOfPeriod(d)}
                    className={dayOfPeriod === d ? "btn btn-primary" : "btn btn-ghost"}
                    style={{ fontSize: 11, padding: "6px 2px", minWidth: 0 }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
            <span className="dim" style={{ fontSize: 11, marginTop: 6, display: "block" }}>
              {formatSchedule(frequency, dayOfPeriod)}
              {frequency === "monthly" && " (si le mois est plus court, on prend le dernier jour)"}
            </span>
          </div>

          <div className="field">
            <label>Motif <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optionnel, 200 chars)</span></label>
            <div className="input">
              <input
                type="text"
                value={motif}
                onChange={(e) => setMotif(e.target.value.slice(0, 200))}
                placeholder="ex : Loyer parents, écolage Aïssatou"
              />
            </div>
          </div>

          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 12, color: "var(--text-secondary)", cursor: "pointer", padding: 12, borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
            <input
              type="checkbox"
              checked={startNow}
              onChange={(e) => setStartNow(e.target.checked)}
              style={{ marginTop: 2 }}
            />
            <span>
              <strong style={{ color: "var(--text-primary)" }}>Démarrer tout de suite</strong>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                La première échéance sera prête dans quelques secondes (pratique pour la démo). Sinon, on attend la prochaine occurrence de « {formatSchedule(frequency, dayOfPeriod).toLowerCase()} ».
              </div>
            </span>
          </label>

          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button type="button" onClick={onClose} className="btn btn-ghost" style={{ flex: 1 }} disabled={submitting}>
              Annuler
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 2 }} disabled={submitting || !lookup}>
              {submitting ? <><Spinner size={14} />Création…</> : <><ShieldCheck size={14} />Créer (PIN requis)</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
