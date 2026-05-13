"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";

interface Competitor {
  name: string;
  feeRate: number;
  delayHours: number;
  color: string;
  note: string;
}

const COMPETITORS: Competitor[] = [
  { name: "DiasporaConnect", feeRate: 0.002, delayHours: 0.05, color: "var(--primary)", note: "Stellar + MoMo" },
  { name: "Wise",            feeRate: 0.039, delayHours: 24,   color: "var(--text-muted)", note: "Virement bancaire" },
  { name: "MoneyGram",       feeRate: 0.06,  delayHours: 1,    color: "var(--gold, #b45309)", note: "Mobile Money" },
  { name: "Western Union",   feeRate: 0.10,  delayHours: 0.5,  color: "var(--accent, #EA580C)", note: "Cash pickup" },
];

export default function ComparePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();
  const [amount, setAmount] = useState(200);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  const rows = useMemo(() => {
    const ourFee = COMPETITORS[0].feeRate * amount;
    return COMPETITORS.map((c) => {
      const fee = Number((c.feeRate * amount).toFixed(2));
      const savings = Math.max(0, fee - ourFee);
      return { ...c, fee, savings };
    });
  }, [amount]);

  if (loading || !isAuthenticated) return null;

  const maxFee = Math.max(...rows.map((r) => r.fee), 1);

  return (
    <DashboardShell title="Comparateur de frais" subtitle="Combien vous économisez sur chaque envoi.">
      <div style={{ display: "grid", gap: 18, maxWidth: 820 }}>
        <section
          style={{
            padding: 20,
            borderRadius: 16,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div className="field">
            <label>Montant simulé (EUR)</label>
            <input
              type="number"
              min={10}
              max={10000}
              step={10}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="input"
              style={{ fontSize: 22, fontWeight: 600, padding: 16 }}
            />
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
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px" }}>
            Pour <span className="mono">{amount}</span> EUR envoyés vers le Bénin
          </h3>
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map((r, i) => (
              <div key={r.name} style={{ display: "grid", gridTemplateColumns: "1.4fr 3fr 1fr", gap: 14, alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: i === 0 ? "var(--primary)" : "var(--text-primary)" }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{r.note}</div>
                </div>
                <div style={{ position: "relative", height: 22, borderRadius: 6, background: "var(--bg-base)", overflow: "hidden" }}>
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: `${(r.fee / maxFee) * 100}%`,
                      background: r.color,
                      borderRadius: 6,
                      transition: "width 240ms ease",
                    }}
                  />
                </div>
                <div style={{ textAlign: "right" }}>
                  <div className="mono" style={{ fontWeight: 600 }}>€{r.fee.toFixed(2)}</div>
                  {i > 0 && (
                    <div className="mono" style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                      = +€{r.savings.toFixed(2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 20,
              padding: 16,
              borderRadius: 12,
              background: "linear-gradient(135deg, var(--primary-soft), transparent)",
              border: "1px solid rgba(45,212,191,0.18)",
            }}
          >
            <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600 }}>
              Économie vs Western Union
            </div>
            <div className="mono" style={{ fontSize: 22, color: "var(--primary)", fontWeight: 600 }}>
              €{rows[rows.length - 1].savings.toFixed(2)} · {Math.round((1 - rows[0].feeRate / rows[rows.length - 1].feeRate) * 100)} % moins de frais
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
