"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";

interface Beneficiaire {
  id: string;
  full_name: string;
  phone: string;
  operator: "mtn" | "moov" | "celtiis";
  country: string;
}

interface CreatedTransfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: string;
  payment: {
    destination: string;
    asset: string;
    amount: string;
    memo: string;
  };
}

interface ApiError {
  error: { code: string; message: string };
}

// Same constants as the backend so the live preview matches the actual values.
const EUR_TO_XOF = 655.957;
const FEE_RATE = 0.002;

export default function TransferPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [fetchingBenefs, setFetchingBenefs] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<number>(200);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedTransfert | null>(null);

  const [adding, setAdding] = useState(false);
  const [addingSubmit, setAddingSubmit] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newOperator, setNewOperator] = useState<"mtn" | "moov" | "celtiis">("moov");

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetch("/api/beneficiaires")
      .then((r) => r.json())
      .then((data: { items?: Beneficiaire[] }) => {
        const items = data.items ?? [];
        setBeneficiaires(items);
        if (items.length > 0) setSelectedId((id) => id || items[0].id);
      })
      .catch(() => toast.error("Impossible de charger les bénéficiaires."))
      .finally(() => setFetchingBenefs(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const fee = Number((amount * FEE_RATE).toFixed(2));
  const netEur = amount - fee;
  const amountXof = Math.round(netEur * EUR_TO_XOF);

  async function addBeneficiaire() {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Renseignez le nom et le téléphone.");
      return;
    }
    setAddingSubmit(true);
    try {
      const res = await fetch("/api/beneficiaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: newName, phone: newPhone, operator: newOperator }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        toast.error(err.error?.message ?? "Échec de l'ajout.");
        return;
      }
      const b = (await res.json()) as Beneficiaire;
      setBeneficiaires((prev) => [b, ...prev]);
      setSelectedId(b.id);
      setAdding(false);
      setNewName("");
      setNewPhone("");
      toast.success(`Bénéficiaire ${b.full_name} ajouté.`);
    } finally {
      setAddingSubmit(false);
    }
  }

  async function submitTransfert(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      toast.error("Sélectionnez un bénéficiaire.");
      return;
    }
    // Action sensible → on demande le PIN avant de créer le transfert.
    const ok = await confirmWithPin({
      title: "Confirme l'envoi",
      subtitle: `Tu vas envoyer ${amount} € depuis ton compte. Saisis ton PIN pour confirmer.`,
    });
    if (!ok) {
      toast.info("Transfert annulé.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/transferts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaire_id: selectedId, amount_eur: amount }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        toast.error(err.error?.message ?? "Échec de la création du transfert.");
        return;
      }
      const data = (await res.json()) as CreatedTransfert;
      setCreated(data);
      toast.success("Transfert créé. Confirmez la signature Stellar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <ConfirmTransfertView
        created={created}
        beneficiaire={beneficiaires.find((b) => b.id === selectedId) ?? null}
        onReset={() => { setCreated(null); setAmount(200); }}
      />
    );
  }

  return (
    <DashboardShell title="Nouvel envoi" subtitle="Envoyer de l'argent au Bénin.">
      <form onSubmit={submitTransfert} style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        <Section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Bénéficiaire</h3>
            <button type="button" className="btn btn-ghost" onClick={() => setAdding((v) => !v)}>
              {adding ? "Annuler" : "+ Nouveau"}
            </button>
          </div>

          {adding && (
            <div style={{ padding: 14, borderRadius: 10, background: "var(--bg-base)", border: "1px dashed var(--border)", marginBottom: 12, display: "grid", gap: 10 }}>
              <TextField label="Nom complet" value={newName} onChange={setNewName} />
              <TextField label="Téléphone (format +229…)" value={newPhone} onChange={setNewPhone} />
              <div className="field">
                <label>Opérateur</label>
                <select
                  className="input"
                  value={newOperator}
                  onChange={(e) => setNewOperator(e.target.value as "mtn" | "moov" | "celtiis")}
                  style={{ padding: "10px 12px" }}
                >
                  <option value="moov">Moov Money</option>
                  <option value="mtn">MTN MoMo</option>
                  <option value="celtiis">Celtiis Cash</option>
                </select>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addBeneficiaire}
                disabled={addingSubmit}
              >
                {addingSubmit ? (<><Spinner size={14} />Ajout…</>) : "Ajouter"}
              </button>
            </div>
          )}

          {fetchingBenefs ? (
            <SkeletonRows count={2} />
          ) : beneficiaires.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
              Aucun bénéficiaire. Cliquez « + Nouveau » pour en ajouter un.
            </p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {beneficiaires.map((b) => (
                <label
                  key={b.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${selectedId === b.id ? "var(--primary)" : "var(--border-subtle)"}`,
                    background: selectedId === b.id ? "var(--primary-soft)" : "transparent",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="benef"
                    checked={selectedId === b.id}
                    onChange={() => setSelectedId(b.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{b.full_name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)" }} className="mono">
                      {b.phone} · {b.operator.toUpperCase()}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </Section>

        <Section>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 12px" }}>Montant</h3>
          <div className="field">
            <label>Vous envoyez (EUR)</label>
            <input
              type="number"
              min={1}
              max={10000}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input"
              style={{ fontSize: 22, fontWeight: 600, padding: 16 }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14, fontSize: 13 }}>
            <Field label="Frais (0,2 %)">
              <span className="mono">{fee.toFixed(2)} EUR</span>
            </Field>
            <Field label="Reçu (XOF)">
              <span className="mono" style={{ fontWeight: 600, color: "var(--primary)" }}>
                {amountXof.toLocaleString("fr-FR")}
              </span>
            </Field>
            <Field label="Taux">
              <span className="mono">1 EUR = {EUR_TO_XOF.toFixed(2)}</span>
            </Field>
          </div>
        </Section>

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={submitting || !selectedId || amount <= 0}
        >
          {submitting ? (
            <><Spinner size={16} />Création…</>
          ) : (
            `Envoyer ${amount} EUR`
          )}
        </button>
      </form>
    </DashboardShell>
  );
}

function Section({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <section
      style={{
        padding: 20,
        borderRadius: 16,
        background: "var(--bg-elevated)",
        border: accent ? "1px solid var(--primary)" : "1px solid var(--border-subtle)",
        boxShadow: accent ? "0 0 0 3px var(--primary-soft)" : "none",
      }}
    >
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ marginTop: 4 }}>{children}</div>
    </div>
  );
}

function TextField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="text"
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ padding: "10px 12px" }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Confirmation screen — separate component so we can have
// its own state (signing/signed) without polluting the form.
// ─────────────────────────────────────────────────────────
interface ConfirmViewProps {
  created: CreatedTransfert;
  beneficiaire: Beneficiaire | null;
  onReset: () => void;
}

function ConfirmTransfertView({ created, beneficiaire, onReset }: ConfirmViewProps) {
  const toast = useToast();
  const [signing, setSigning] = React.useState(false);
  const [status, setStatus] = React.useState<string>(created.status);
  const [stellarHash, setStellarHash] = React.useState<string | null>(null);

  async function confirmStellarSignature() {
    setSigning(true);
    try {
      const res = await fetch(`/api/transferts/${created.id}/submit-stellar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}), // demo mode: no tx_hash, backend will accept
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la confirmation Stellar.");
        return;
      }
      setStatus(data.status);
      setStellarHash(data.stellar_tx_hash);
      toast.success("Paiement Stellar confirmé. Le bénéficiaire peut retirer maintenant.");
    } finally {
      setSigning(false);
    }
  }

  const isConfirmed = status === "stellar_received" || status === "momo_initiated" || status === "completed";

  return (
    <DashboardShell title="Transfert créé" subtitle={isConfirmed ? "Paiement confirmé. Le bénéficiaire peut retirer." : "Étape suivante : signer la transaction Stellar."}>
      <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
        <Section>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Transfert</div>
          <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>{created.id}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
            <Field label="Bénéficiaire">{beneficiaire?.full_name ?? "—"}</Field>
            <Field label="Téléphone">{beneficiaire?.phone ?? "—"}</Field>
            <Field label="Montant débité">{created.amount_eur.toFixed(2)} EUR</Field>
            <Field label="Frais (0,2 %)">{created.fee_eur.toFixed(2)} EUR</Field>
            <Field label="Reçu par le bénéficiaire">
              <strong style={{ fontSize: 18 }}>{created.amount_xof.toLocaleString("fr-FR")} XOF</strong>
            </Field>
            <Field label="Statut">
              <span
                className={isConfirmed ? "pill" : "pill primary"}
                style={{
                  textTransform: "uppercase",
                  background: isConfirmed ? "rgba(34,197,94,0.15)" : undefined,
                  color: isConfirmed ? "#15803d" : undefined,
                }}
              >
                {status}
              </span>
            </Field>
          </div>
          {stellarHash && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--bg-base)", fontSize: 12 }}>
              <div style={{ color: "var(--text-tertiary)", marginBottom: 4 }}>Hash Stellar</div>
              <div className="mono" style={{ wordBreak: "break-all" }}>{stellarHash}</div>
            </div>
          )}
        </Section>

        {!isConfirmed && (
          <Section accent>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
              Signature de la transaction Stellar
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 14px" }}>
              En production, votre wallet (Freighter / Lobstr) signe automatiquement. Pour la démo,
              cliquez ci-dessous pour simuler la signature et passer à l'étape suivante.
            </p>
            <details style={{ marginBottom: 14 }}>
              <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
                Voir les paramètres on-chain
              </summary>
              <div style={{ display: "grid", gap: 8, marginTop: 8, padding: 12, background: "var(--bg-base)", borderRadius: 8 }}>
                <Field label="Destination">
                  <span className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
                    {created.payment.destination}
                  </span>
                </Field>
                <Field label="Asset">{created.payment.asset} testnet</Field>
                <Field label="Montant">
                  <span className="mono">{created.payment.amount} USDC</span>
                </Field>
                <Field label="Memo">
                  <span className="mono" style={{ fontSize: 11 }}>{created.payment.memo}</span>
                </Field>
              </div>
            </details>
            <button
              type="button"
              className="btn btn-primary btn-lg btn-block"
              onClick={confirmStellarSignature}
              disabled={signing}
            >
              {signing ? (<><Spinner size={16} />Confirmation…</>) : "Confirmer la signature Stellar (démo)"}
            </button>
          </Section>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/history" className="btn btn-ghost">Voir l'historique</Link>
          <button type="button" className="btn btn-primary" onClick={onReset}>
            Nouveau transfert
          </button>
        </div>
      </div>
    </DashboardShell>
  );
}
