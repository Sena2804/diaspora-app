"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";

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

  const [beneficiaires, setBeneficiaires] = useState<Beneficiaire[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [amount, setAmount] = useState<number>(200);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedTransfert | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
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
      .catch(() => setError("Impossible de charger les bénéficiaires."));
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  const fee = Number((amount * FEE_RATE).toFixed(2));
  const netEur = amount - fee;
  const amountXof = Math.round(netEur * EUR_TO_XOF);

  async function addBeneficiaire() {
    setError(null);
    const res = await fetch("/api/beneficiaires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: newName, phone: newPhone, operator: newOperator }),
    });
    if (!res.ok) {
      const err = (await res.json()) as ApiError;
      setError(err.error?.message ?? "Échec de l'ajout.");
      return;
    }
    const b = (await res.json()) as Beneficiaire;
    setBeneficiaires((prev) => [b, ...prev]);
    setSelectedId(b.id);
    setAdding(false);
    setNewName("");
    setNewPhone("");
  }

  async function submitTransfert(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("Sélectionnez un bénéficiaire.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/transferts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaire_id: selectedId, amount_eur: amount }),
      });
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        setError(err.error?.message ?? "Échec de la création du transfert.");
        return;
      }
      const data = (await res.json()) as CreatedTransfert;
      setCreated(data);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const selected = beneficiaires.find((b) => b.id === selectedId);
    return (
      <DashboardShell title="Transfert créé" subtitle="Étape suivante : signer la transaction Stellar.">
        <div style={{ display: "grid", gap: 20, maxWidth: 720 }}>
          <Section>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>Transfert</div>
            <div className="mono" style={{ fontSize: 13, marginTop: 4 }}>{created.id}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 18 }}>
              <Field label="Bénéficiaire">{selected?.full_name ?? "—"}</Field>
              <Field label="Téléphone">{selected?.phone ?? "—"}</Field>
              <Field label="Montant débité">{created.amount_eur.toFixed(2)} EUR</Field>
              <Field label="Frais (0,2 %)">{created.fee_eur.toFixed(2)} EUR</Field>
              <Field label="Reçu par le bénéficiaire">
                <strong style={{ fontSize: 18 }}>{created.amount_xof.toLocaleString("fr-FR")} XOF</strong>
              </Field>
              <Field label="Statut">
                <span className="pill primary" style={{ textTransform: "uppercase" }}>{created.status}</span>
              </Field>
            </div>
          </Section>

          <Section accent>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--primary)" }}>
              Payload à signer côté wallet
            </div>
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "4px 0 14px" }}>
              Connectez Freighter pour signer automatiquement (J3). En attendant, voici les
              paramètres exacts à reproduire sur Stellar Laboratory&nbsp;:
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Destination (wallet plateforme)">
                <span className="mono" style={{ fontSize: 12, wordBreak: "break-all" }}>
                  {created.payment.destination}
                </span>
              </Field>
              <Field label="Asset">{created.payment.asset} testnet</Field>
              <Field label="Montant à envoyer">
                <span className="mono">{created.payment.amount} USDC</span>
              </Field>
              <Field label="Memo (MEMO_TEXT)">
                <span className="mono" style={{ fontSize: 12 }}>{created.payment.memo}</span>
              </Field>
            </div>
          </Section>

          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/history" className="btn btn-ghost">Voir l'historique</Link>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { setCreated(null); setAmount(200); setError(null); }}
            >
              Nouveau transfert
            </button>
          </div>
        </div>
      </DashboardShell>
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
              <button type="button" className="btn btn-primary" onClick={addBeneficiaire}>
                Ajouter
              </button>
            </div>
          )}

          {beneficiaires.length === 0 ? (
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

        {error && (
          <div style={{ padding: 12, borderRadius: 10, background: "rgba(234, 88, 12, 0.10)", color: "var(--accent, #EA580C)", fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={submitting || !selectedId || amount <= 0}
        >
          {submitting ? "Création…" : `Envoyer ${amount} EUR`}
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
