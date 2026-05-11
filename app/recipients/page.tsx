"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";

interface Beneficiaire {
  id: string;
  full_name: string;
  phone: string;
  operator: "mtn" | "moov" | "celtiis";
  country: string;
  created_at: string;
}

interface ApiError {
  error: { code: string; message: string };
}

const OPERATOR_LABEL: Record<Beneficiaire["operator"], string> = {
  mtn: "MTN MoMo",
  moov: "Moov Money",
  celtiis: "Celtiis Cash",
};

export default function RecipientsPage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<Beneficiaire[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState<"mtn" | "moov" | "celtiis">("moov");

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  async function refresh() {
    setFetching(true);
    try {
      const res = await fetch("/api/beneficiaires");
      const data = (await res.json()) as { items?: Beneficiaire[] };
      setItems(data.items ?? []);
    } catch {
      setError("Impossible de charger les bénéficiaires.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    if (isAuthenticated) refresh();
  }, [isAuthenticated]);

  if (loading || !isAuthenticated) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/beneficiaires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: name, phone, operator }),
    });
    if (!res.ok) {
      const err = (await res.json()) as ApiError;
      setError(err.error?.message ?? "Échec.");
      return;
    }
    setName("");
    setPhone("");
    setOperator("moov");
    setAdding(false);
    await refresh();
  }

  return (
    <DashboardShell
      title="Destinataires"
      subtitle="Vos bénéficiaires enregistrés au Bénin."
      actions={
        <button className="btn btn-primary" onClick={() => setAdding((v) => !v)}>
          {adding ? "Annuler" : "+ Nouveau"}
        </button>
      }
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        {adding && (
          <form
            onSubmit={submit}
            style={{
              padding: 20,
              borderRadius: 16,
              background: "var(--bg-elevated)",
              border: "1px solid var(--primary)",
              boxShadow: "0 0 0 3px var(--primary-soft)",
              display: "grid",
              gap: 12,
            }}
          >
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Nouveau bénéficiaire</h3>
            <div className="field">
              <label>Nom complet</label>
              <input
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{ padding: "10px 12px" }}
              />
            </div>
            <div className="field">
              <label>Téléphone (format international, +229…)</label>
              <input
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                style={{ padding: "10px 12px" }}
              />
            </div>
            <div className="field">
              <label>Opérateur Mobile Money</label>
              <select
                className="input"
                value={operator}
                onChange={(e) => setOperator(e.target.value as Beneficiaire["operator"])}
                style={{ padding: "10px 12px" }}
              >
                <option value="moov">Moov Money</option>
                <option value="mtn">MTN MoMo</option>
                <option value="celtiis">Celtiis Cash</option>
              </select>
            </div>
            {error && (
              <div style={{ padding: 10, borderRadius: 8, background: "rgba(234, 88, 12, 0.10)", color: "var(--accent, #EA580C)", fontSize: 13 }}>
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary">Enregistrer</button>
          </form>
        )}

        {fetching ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)" }}>Chargement…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", border: "1px dashed var(--border)", borderRadius: 16 }}>
            <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: "0 0 12px" }}>
              Vous n'avez pas encore enregistré de bénéficiaire.
            </p>
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              + Ajouter le premier
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {items.map((b) => (
              <div
                key={b.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: 16,
                  borderRadius: 12,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "var(--primary-soft)",
                    color: "var(--primary)",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                  }}
                >
                  {b.full_name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{b.full_name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)" }} className="mono">
                    {b.phone} · {OPERATOR_LABEL[b.operator]} · {b.country}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)" }} className="mono">
                  Ajouté {new Date(b.created_at).toLocaleDateString("fr-FR")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
