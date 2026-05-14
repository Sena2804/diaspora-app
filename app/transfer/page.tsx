"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2, AtSign, ArrowRight, ArrowLeft, CheckCircle2, ShieldCheck, ShieldAlert, AlertCircle, Send, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";
import { findCountry } from "@/lib/countries";

interface ResolvedRecipient {
  wallet_id: string;
  first_name: string | null;
  last_name: string | null;
  country: string | null;
  kyc_status: "pending" | "verified" | "rejected" | null;
  can_receive: boolean;
  is_self: boolean;
}

interface RecipientRow {
  id: string; // local row id (React key)
  walletId: string;
  amount: string;
  resolved: ResolvedRecipient | null;
  lookupError: string | null;
  lookingUp: boolean;
}

interface CreatedItem {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: string;
  motif: string | null;
  recipient: ResolvedRecipient | null;
  payment: { destination: string; asset: string; amount: string; memo: string };
}

interface BatchResponse {
  batch_id: string;
  items: CreatedItem[];
  total_eur: number;
  total_xof: number;
  total_fee_eur: number;
  count: number;
}

type Step = "compose" | "confirm" | "submitted";

const WALLET_ID_REGEX = /^DC-[A-Z0-9]{4}-[A-Z0-9]{4}$/i;
const newRow = (): RecipientRow => ({
  id: Math.random().toString(36).slice(2),
  walletId: "",
  amount: "",
  resolved: null,
  lookupError: null,
  lookingUp: false,
});

export default function TransferPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [step, setStep] = useState<Step>("compose");
  const [rows, setRows] = useState<RecipientRow[]>([newRow()]);
  const [motif, setMotif] = useState("");
  const [sameAmount, setSameAmount] = useState(false);
  const [sharedAmount, setSharedAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<BatchResponse | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  // ⚠ AUCUN return ne doit se trouver AVANT le useMemo ci-dessous,
  // sinon React verrait un hook count différent entre 1er et 2e render
  // (1er render : loading=true → early return → useMemo skippé ; 2e render :
  // loading=false → useMemo appelé → +1 hook → erreur "Rendered more hooks").
  const totalEur = useMemo(() => {
    return rows.reduce((acc, r) => {
      const a = Number(sameAmount ? sharedAmount : r.amount);
      return acc + (isNaN(a) ? 0 : a);
    }, 0);
  }, [rows, sameAmount, sharedAmount]);

  if (loading || !isAuthenticated) return null;

  // ─── Helpers ───
  const addRow = () => setRows((prev) => [...prev, newRow()]);
  const removeRow = (id: string) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.id !== id)));

  const updateRow = (id: string, patch: Partial<RecipientRow>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  async function lookupRow(row: RecipientRow) {
    const upper = row.walletId.trim().toUpperCase();
    if (!WALLET_ID_REGEX.test(upper)) {
      updateRow(row.id, { lookupError: "Format invalide. Attendu : DC-XXXX-XXXX.", resolved: null });
      return null;
    }
    updateRow(row.id, { lookingUp: true, lookupError: null });
    try {
      const res = await fetch(`/api/lookup?id=${encodeURIComponent(upper)}`);
      const data = await res.json();
      if (!res.ok) {
        updateRow(row.id, { lookupError: data?.error?.message ?? "Destinataire introuvable.", resolved: null, lookingUp: false });
        return null;
      }
      const resolved = data as ResolvedRecipient;
      if (resolved.is_self) {
        updateRow(row.id, { lookupError: "Tu ne peux pas t'envoyer de l'argent à toi-même.", resolved: null, lookingUp: false });
        return null;
      }
      updateRow(row.id, { resolved, lookupError: null, lookingUp: false });
      return resolved;
    } catch {
      updateRow(row.id, { lookupError: "Erreur réseau.", lookingUp: false });
      return null;
    }
  }

  async function handleCompose(e: React.FormEvent) {
    e.preventDefault();

    // 1. Vérifie que chaque ligne a un wallet_id + un montant valide
    for (const r of rows) {
      const a = Number(sameAmount ? sharedAmount : r.amount);
      if (!r.walletId.trim()) {
        toast.error("Renseigne tous les identifiants destinataires.");
        return;
      }
      if (!WALLET_ID_REGEX.test(r.walletId.trim().toUpperCase())) {
        toast.error(`Format invalide pour ${r.walletId}.`);
        return;
      }
      if (!a || a <= 0) {
        toast.error("Tous les montants doivent être supérieurs à 0.");
        return;
      }
    }
    // 2. Détecte les doublons
    const seen = new Set<string>();
    for (const r of rows) {
      const upper = r.walletId.trim().toUpperCase();
      if (seen.has(upper)) {
        toast.error(`Destinataire ${upper} en double.`);
        return;
      }
      seen.add(upper);
    }

    // 3. Lookup chaque destinataire (en parallèle).
    setSubmitting(true);
    try {
      const results = await Promise.all(rows.map((r) => lookupRow(r)));
      const allResolved = results.every((r) => r !== null);
      if (!allResolved) {
        toast.error("Certains identifiants ne sont pas valides. Vois ci-dessous.");
        return;
      }
      // Cas particulier : empêche d'envoyer à un destinataire non-vérifié
      for (let i = 0; i < results.length; i++) {
        const r = results[i]!;
        if (!r.can_receive) {
          toast.error(`${r.wallet_id} n'a pas vérifié son numéro Mobile Money.`);
          return;
        }
      }
      setStep("confirm");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleValidate() {
    const ok = await confirmWithPin({
      title: "Confirme l'envoi",
      subtitle: `Tu vas envoyer ${totalEur.toFixed(2)} € à ${rows.length} destinataire${rows.length > 1 ? "s" : ""}.`,
    });
    if (!ok) {
      toast.info("Envoi annulé.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        recipients: rows.map((r) => ({
          wallet_id: r.walletId.trim().toUpperCase(),
          amount_eur: Number(sameAmount ? sharedAmount : r.amount),
        })),
        motif: motif.trim() || undefined,
      };
      const res = await fetch("/api/transferts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la création.");
        return;
      }
      setCreated(data as BatchResponse);
      setStep("submitted");
      toast.success(`${data.count} transfert(s) créé(s).`);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setStep("compose");
    setRows([newRow()]);
    setMotif("");
    setSameAmount(false);
    setSharedAmount("");
    setCreated(null);
  }

  // ═══════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════
  if (step === "submitted" && created) {
    return <SubmittedView created={created} motif={motif} onReset={reset} />;
  }

  if (step === "confirm") {
    return (
      <DashboardShell title="Confirme ton envoi" subtitle={`${rows.length} destinataire${rows.length > 1 ? "s" : ""} · Total à débiter ${totalEur.toFixed(2)} €`}>
        <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
          {rows.map((r, idx) => {
            const a = Number(sameAmount ? sharedAmount : r.amount);
            return (
              <RecipientCard key={r.id} index={idx + 1} resolved={r.resolved!} amountEur={a} motif={motif || null} />
            );
          })}

          <div style={summaryCardStyle()}>
            <Row label="Montant à débiter" value={`${totalEur.toFixed(2)} €`} bold />
            <Row label="Frais DiasporaConnect (0,2 %)" value={`${(totalEur * 0.002).toFixed(2)} €`} />
            <Row label="Total reçu (estimé)" value={`${Math.round(totalEur * (1 - 0.002) * 655.957).toLocaleString("fr-FR")} XOF`} />
            {motif && <Row label="Motif" value={motif} />}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => setStep("compose")} className="btn btn-ghost" style={{ flex: 1 }}>
              <ArrowLeft size={14} /> Modifier
            </button>
            <button onClick={handleValidate} disabled={submitting} className="btn btn-primary" style={{ flex: 2 }}>
              {submitting ? <><Spinner size={14} />Envoi…</> : <><ShieldCheck size={14} /> Valider l&apos;envoi (PIN requis)</>}
            </button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  // ─── Step compose ───
  return (
    <DashboardShell
      title="Nouvel envoi"
      subtitle="Envoie de l'argent à un ou plusieurs destinataires en quelques secondes."
    >
      <form onSubmit={handleCompose} style={{ display: "grid", gap: 18, maxWidth: 760 }}>
        {/* Same-amount toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 12, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Même montant pour tous ?</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
              Utile pour des cadeaux groupés, salaires d&apos;employés, etc.
            </div>
          </div>
          <label style={{ position: "relative", width: 42, height: 24, cursor: "pointer", flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={sameAmount}
              onChange={(e) => setSameAmount(e.target.checked)}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span style={{ position: "absolute", inset: 0, background: sameAmount ? "var(--primary)" : "var(--border)", borderRadius: 999, transition: "0.2s" }}>
              <span style={{ position: "absolute", top: 2, left: sameAmount ? 20 : 2, width: 20, height: 20, background: "#fff", borderRadius: "50%", transition: "0.2s" }} />
            </span>
          </label>
        </div>

        {sameAmount && (
          <div className="field">
            <label>Montant à envoyer à chaque destinataire (€)</label>
            <div className="input">
              <input
                type="number"
                step="0.01"
                min="1"
                value={sharedAmount}
                onChange={(e) => setSharedAmount(e.target.value)}
                placeholder="50"
                required
              />
              <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>€</span>
            </div>
          </div>
        )}

        {/* Recipient rows */}
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
            Destinataire{rows.length > 1 ? "s" : ""} ({rows.length})
          </div>

          {rows.map((r, idx) => (
            <div key={r.id} style={recipientRowStyle()}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: r.lookupError || r.resolved ? 6 : 0 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", minWidth: 22 }}>
                  #{idx + 1}
                </span>
                <div className="input" style={{ flex: 2 }}>
                  <AtSign size={14} color="var(--text-tertiary)" />
                  <input
                    type="text"
                    value={r.walletId}
                    onChange={(e) => updateRow(r.id, { walletId: e.target.value.toUpperCase(), resolved: null, lookupError: null })}
                    onBlur={() => r.walletId.trim() && lookupRow(r)}
                    placeholder="DC-XXXX-XXXX"
                    style={{ textTransform: "uppercase", letterSpacing: "0.03em" }}
                    required
                  />
                  {r.lookingUp && <Spinner size={12} />}
                </div>
                {!sameAmount && (
                  <div className="input" style={{ flex: 1, maxWidth: 130 }}>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={r.amount}
                      onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                      placeholder="Montant"
                      required
                    />
                    <span style={{ color: "var(--text-tertiary)", fontSize: 13 }}>€</span>
                  </div>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    aria-label="Retirer ce destinataire"
                    style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-tertiary)", padding: 6, display: "flex" }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {r.lookupError && (
                <div style={{ fontSize: 11, color: "#b91c1c", display: "flex", alignItems: "center", gap: 6, marginLeft: 30 }}>
                  <AlertCircle size={12} /> {r.lookupError}
                </div>
              )}
              {r.resolved && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginLeft: 30, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={12} color="#15803d" />
                  <strong style={{ color: "var(--text-primary)" }}>
                    {[r.resolved.first_name, r.resolved.last_name].filter(Boolean).join(" ") || r.resolved.wallet_id}
                  </strong>
                  {r.resolved.country && <span>· {r.resolved.country}</span>}
                  {r.resolved.kyc_status === "verified" && <ShieldCheck size={12} color="#15803d" />}
                </div>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="btn btn-ghost"
            style={{ alignSelf: "start", fontSize: 12, padding: "6px 12px" }}
          >
            <Plus size={14} /> Ajouter un destinataire
          </button>
        </div>

        {/* Motif */}
        <div className="field">
          <label>Motif du transfert <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optionnel)</span></label>
          <div className="input">
            <Sparkles size={14} color="var(--text-tertiary)" />
            <input
              type="text"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="ex. Anniversaire de maman, écolage, mariage…"
              maxLength={200}
            />
          </div>
        </div>

        {/* Total preview */}
        {totalEur > 0 && (
          <div style={{ padding: 14, borderRadius: 12, background: "var(--primary-soft)", border: "1px solid var(--primary)", fontSize: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "var(--text-secondary)" }}>Total à débiter</span>
            <span style={{ fontWeight: 700, fontSize: 18, color: "var(--primary)" }} className="mono">
              {totalEur.toFixed(2)} €
            </span>
          </div>
        )}

        <button type="submit" disabled={submitting || rows.length === 0} className="btn btn-primary btn-lg">
          {submitting ? <><Spinner size={14} />Vérification…</> : <>Envoyer <ArrowRight size={16} /></>}
        </button>

        <p className="dim" style={{ fontSize: 11, lineHeight: 1.5, textAlign: "center" }}>
          🔒 Avant validation, tu verras un récapitulatif des destinataires et leurs noms.
        </p>
      </form>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────
// View 3 : confirmation + Stellar signature (demo mode).
// ─────────────────────────────────────────────────────────
function SubmittedView({ created, motif, onReset }: { created: BatchResponse; motif: string; onReset: () => void }) {
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();
  const [signing, setSigning] = useState(false);
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());

  async function confirmAll() {
    const ok = await confirmWithPin({
      title: "Confirme la signature Stellar",
      subtitle: `Tu autorises le débit de ${created.total_eur.toFixed(2)} € depuis ton compte.`,
    });
    if (!ok) return;

    setSigning(true);
    try {
      const results = await Promise.all(
        created.items.map(async (t) => {
          const res = await fetch(`/api/transferts/${t.id}/submit-stellar`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({}), // demo mode
          });
          return { id: t.id, ok: res.ok };
        }),
      );
      const okIds = new Set(results.filter((r) => r.ok).map((r) => r.id));
      setSignedIds(okIds);
      if (okIds.size === created.items.length) {
        toast.success("Tous les paiements ont été confirmés sur Stellar.");
      } else {
        toast.error(`${created.items.length - okIds.size} transfert(s) n'ont pas pu être confirmés.`);
      }
    } finally {
      setSigning(false);
    }
  }

  const allSigned = signedIds.size === created.items.length;

  return (
    <DashboardShell
      title="Transferts créés ✓"
      subtitle={`${created.count} transfert(s) en attente de signature Stellar.`}
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
        {created.items.map((t, idx) => (
          <div key={t.id} style={signedIds.has(t.id) ? recipientCardSignedStyle() : recipientCardStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>#{idx + 1} · {t.recipient?.wallet_id ?? "—"}</div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>
                  {[t.recipient?.first_name, t.recipient?.last_name].filter(Boolean).join(" ") || "—"}
                </div>
                {t.motif && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, fontStyle: "italic" }}>« {t.motif} »</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{t.amount_eur.toFixed(2)} €</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                  {t.amount_xof.toLocaleString("fr-FR")} XOF
                </div>
                {signedIds.has(t.id) && (
                  <div style={{ fontSize: 11, color: "#15803d", marginTop: 4, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end" }}>
                    <CheckCircle2 size={12} /> Signé Stellar
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        <div style={summaryCardStyle()}>
          <Row label="Total débité" value={`${created.total_eur.toFixed(2)} €`} bold />
          <Row label="Frais totaux" value={`${created.total_fee_eur.toFixed(2)} €`} />
          <Row label="Reçu par destinataires" value={`${created.total_xof.toLocaleString("fr-FR")} XOF`} />
        </div>

        {!allSigned ? (
          <div style={{ padding: 16, borderRadius: 12, background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.3)" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>📡 Signature Stellar (démo)</div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "0 0 12px", lineHeight: 1.5 }}>
              En production, ton wallet Freighter signerait automatiquement. Pour la démo on simule la confirmation.
            </p>
            <button onClick={confirmAll} disabled={signing} className="btn btn-primary">
              {signing ? <><Spinner size={14} />Confirmation…</> : <><Send size={14} /> Confirmer la signature pour tous</>}
            </button>
          </div>
        ) : (
          <div style={{ padding: 16, borderRadius: 12, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)", display: "flex", alignItems: "center", gap: 12 }}>
            <CheckCircle2 size={22} color="#15803d" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#15803d" }}>Tous les paiements confirmés</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Les destinataires peuvent déjà voir leurs fonds dans /wallet.</div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onReset} className="btn btn-ghost" style={{ flex: 1 }}>
            Faire un autre envoi
          </button>
          <Link href="/history" className="btn" style={{ flex: 1 }}>
            Voir mon historique
          </Link>
        </div>
      </div>
    </DashboardShell>
  );
}

// ─────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────
function RecipientCard({ index, resolved, amountEur, motif }: { index: number; resolved: ResolvedRecipient; amountEur: number; motif: string | null }) {
  const countryName = findCountry(resolved.country ?? "")?.name ?? resolved.country ?? "—";
  const countryFlag = findCountry(resolved.country ?? "")?.flag ?? "";
  return (
    <div style={recipientCardStyle()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 2 }}>
            Destinataire #{index} · <span className="mono">{resolved.wallet_id}</span>
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {[resolved.first_name, resolved.last_name].filter(Boolean).join(" ") || resolved.wallet_id}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span>{countryFlag} {countryName}</span>
            <span>·</span>
            {resolved.kyc_status === "verified" ? (
              <span style={{ color: "#15803d", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <ShieldCheck size={12} /> Identité vérifiée
              </span>
            ) : (
              <span style={{ color: "#b45309", display: "inline-flex", alignItems: "center", gap: 3 }}>
                <ShieldAlert size={12} /> KYC en cours
              </span>
            )}
          </div>
          {motif && <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 8, fontStyle: "italic" }}>« {motif} »</div>}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="mono" style={{ fontSize: 20, fontWeight: 700, color: "var(--primary)" }}>
            {amountEur.toFixed(2)} €
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
            ≈ {Math.round(amountEur * (1 - 0.002) * 655.957).toLocaleString("fr-FR")} XOF
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 13, fontWeight: bold ? 700 : 500 }}>{value}</span>
    </div>
  );
}

function recipientRowStyle(): React.CSSProperties {
  return { padding: 12, borderRadius: 10, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" };
}

function recipientCardStyle(): React.CSSProperties {
  return { padding: 18, borderRadius: 14, background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" };
}

function recipientCardSignedStyle(): React.CSSProperties {
  return { ...recipientCardStyle(), borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.05)" };
}

function summaryCardStyle(): React.CSSProperties {
  return { padding: 18, borderRadius: 12, background: "var(--bg-base)", border: "1px solid var(--border-subtle)", display: "grid", gap: 4 };
}
