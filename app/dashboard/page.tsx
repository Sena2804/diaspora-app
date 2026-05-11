"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import styles from "./dashboard.module.css";
import {
  ArrowRightIcon,
  DollarSignIcon,
  ClockIcon,
  UsersIcon,
  ActivityIcon,
  PlusIcon,
  LinkIcon,
  TrendingUpIcon,
} from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

type Status =
  | "pending"
  | "stellar_pending"
  | "stellar_received"
  | "momo_initiated"
  | "completed"
  | "failed";

interface Transfert {
  id: string;
  amount_eur: number;
  amount_xof: number;
  fee_eur: number;
  status: Status;
  created_at: string;
  beneficiaire: {
    full_name: string;
    phone: string;
    operator: "mtn" | "moov" | "celtiis";
    country: string;
  } | null;
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "En attente",
  stellar_pending: "Stellar en cours",
  stellar_received: "USDC reçus",
  momo_initiated: "MoMo en cours",
  completed: "Retiré",
  failed: "Échec",
};

export default function DashboardPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const [transferts, setTransferts] = useState<Transfert[]>([]);
  const [beneficiairesCount, setBeneficiairesCount] = useState<number>(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    Promise.all([
      fetch("/api/transferts?limit=50").then((r) => r.json()),
      fetch("/api/beneficiaires").then((r) => r.json()),
    ])
      .then(([t, b]: [{ items?: Transfert[] }, { items?: unknown[] }]) => {
        setTransferts(t.items ?? []);
        setBeneficiairesCount((b.items ?? []).length);
      })
      .catch(() => {
        setTransferts([]);
        setBeneficiairesCount(0);
      });
  }, [isAuthenticated]);

  // ---- Derived metrics from real data ----
  const stats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const thisMonth = transferts.filter((t) => {
      const d = new Date(t.created_at);
      return d.getMonth() === month && d.getFullYear() === year;
    });
    const sentThisMonth = thisMonth.reduce((acc, t) => acc + Number(t.amount_eur), 0);
    const feesThisMonth = thisMonth.reduce((acc, t) => acc + Number(t.fee_eur), 0);
    // Estimated savings vs the 10% average legacy operator fee
    const wouldHavePaid10pct = sentThisMonth * 0.1;
    const savings = Math.max(0, wouldHavePaid10pct - feesThisMonth);
    return {
      countThisMonth: thisMonth.length,
      sentThisMonth,
      feesThisMonth,
      savings,
    };
  }, [transferts]);

  const recent = transferts.slice(0, 3);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardShell
      title={`Bonjour ${user?.email.split("@")[0]} 👋`}
      subtitle={
        stats.savings > 0 ? (
          <>
            Vous avez économisé{" "}
            <span style={{ color: "var(--primary)" }} className="mono">
              €{stats.savings.toFixed(2)}
            </span>{" "}
            de frais ce mois-ci.
          </>
        ) : (
          <>Voici un résumé de votre activité ce mois-ci.</>
        )
      }
    >
      {/* Top row : hero + KPIs */}
      <div className={styles.grid2}>
        <div className={styles.heroCard}>
          <div className={styles.heroBalance}>
            <div>
              <div className={styles.label}>Envoyé ce mois</div>
              <div className={styles.value}>
                {stats.sentThisMonth.toFixed(2)}
                <span className={styles.currency}>EUR</span>
              </div>
              <div className={styles.convert}>
                ≈ {Math.round(stats.sentThisMonth * 655.957).toLocaleString("fr-FR")} XOF reçus
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <span className="pill primary">
                <span className="dot pulse"></span>Stellar Testnet
              </span>
              <span className="hash">
                <LinkIcon style={{ width: "11px", height: "11px" }} />
                Wallet plateforme
              </span>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Link href="/transfer" className="btn btn-primary btn-lg">
              <ArrowRightIcon strokeWidth={2.4} style={{ width: "16px", height: "16px" }} />
              Envoyer au Bénin
            </Link>
            <Link href="/recipients" className="btn btn-ghost btn-lg">
              <UsersIcon style={{ width: "16px", height: "16px" }} />
              Bénéficiaires
            </Link>
            <Link href="/history" className="btn btn-ghost btn-lg">
              <ClockIcon style={{ width: "16px", height: "16px" }} />
              Historique
            </Link>
          </div>

          <div className={styles.impactStrip}>
            <div className={styles.left}>
              <div className={styles.ribbonIc}>
                <ActivityIcon style={{ width: "18px", height: "18px" }} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>Impact ODD&nbsp;10 — vos économies</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>
                  Vs services traditionnels (8-12 % moyen)
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: "22px", fontWeight: 600, color: "var(--primary)" }}>
                €{stats.savings.toFixed(2)}
              </div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }} className="mono">
                {stats.countThisMonth} transfert{stats.countThisMonth > 1 ? "s" : ""} · ce mois
              </div>
            </div>
          </div>
        </div>

        {/* KPIs grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Envoyés ce mois</span>
              <div className={styles.ic} style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
                <ArrowRightIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>€{stats.sentThisMonth.toFixed(0)}</div>
            <div className={styles.delta}>
              <TrendingUpIcon style={{ width: "10px", height: "10px" }} />
              {stats.countThisMonth} transfert{stats.countThisMonth > 1 ? "s" : ""}
            </div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Frais payés</span>
              <div className={styles.ic} style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                <DollarSignIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>€{stats.feesThisMonth.toFixed(2)}</div>
            <div className={styles.delta}>0,2 % effectif</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Total transferts</span>
              <div className={styles.ic} style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <ClockIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>{transferts.length}</div>
            <div className={styles.delta}>Depuis l'inscription</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Bénéficiaires</span>
              <div className={styles.ic} style={{ background: "rgba(167,139,250,0.12)", color: "#A78BFA" }}>
                <UsersIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>{beneficiairesCount}</div>
            <div className={styles.delta}>Enregistrés</div>
          </div>
        </div>
      </div>

      {/* Middle row : Recent + Compare */}
      <div className={styles.grid2} style={{ marginTop: "18px" }}>
        <div className="card">
          <div className={styles.sectionHead}>
            <h3>Transferts récents</h3>
            <Link href="/history">Voir tout →</Link>
          </div>

          {recent.length === 0 ? (
            <div style={{ padding: 30, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              Aucun transfert pour le moment.{" "}
              <Link href="/transfer" style={{ color: "var(--primary)" }}>
                Faire le premier
              </Link>
            </div>
          ) : (
            recent.map((t, i) => {
              const initials = (t.beneficiaire?.full_name ?? "??")
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase();
              const variant = i === 0 ? "" : i === 1 ? styles.t2 : styles.t3;
              const opLabel = t.beneficiaire?.operator
                ? t.beneficiaire.operator === "mtn"
                  ? "MTN MoMo"
                  : t.beneficiaire.operator === "moov"
                    ? "Moov Money"
                    : "Celtiis Cash"
                : "—";
              return (
                <div key={t.id} className={`${styles.recentTx} ${variant}`}>
                  <div className={styles.av}>{initials}</div>
                  <div className={styles.info}>
                    <div className={styles.name}>{t.beneficiaire?.full_name ?? "Bénéficiaire"}</div>
                    <div className={styles.sub}>
                      <span className="mono">→ {t.beneficiaire?.phone ?? "—"}</span>
                      {" · "}
                      {opLabel}
                      <span
                        className={t.status === "completed" ? "pill success" : "pill primary"}
                        style={{ padding: "1px 7px", fontSize: "10px" }}
                      >
                        <span className={`dot ${t.status === "completed" ? "" : "pulse"}`}></span>
                        {STATUS_LABEL[t.status]}
                      </span>
                    </div>
                  </div>
                  <div className={styles.right}>
                    <div className={styles.amt} style={{ color: "var(--success)" }}>
                      −€{Number(t.amount_eur).toFixed(2)}
                    </div>
                    <div className={styles.metaR}>
                      {Number(t.amount_xof).toLocaleString("fr-FR")} XOF ·{" "}
                      {new Date(t.created_at).toLocaleDateString("fr-FR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Comparator card — keeps the static demo numbers since it's a marketing widget */}
        <div className="card">
          <div className={styles.sectionHead}>
            <h3>Vous économisez sur chaque envoi</h3>
            <span className="pill primary">
              <span className="dot"></span>Live
            </span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "0 0 14px" }}>
            Pour <span className="mono" style={{ color: "var(--text-primary)" }}>€200</span> envoyés vers le Bénin :
          </p>

          <div className="compare-row us">
            <div className="name">
              <span className="dot" style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "currentColor" }}></span>
              DiasporaConnect
            </div>
            <div className="bar-wrap">
              <div className="bar-fill" style={{ width: "5%", background: "var(--primary)" }}></div>
            </div>
            <div className="fee">€0,40</div>
          </div>
          <div className="compare-row">
            <div className="name">Wise</div>
            <div className="bar-wrap">
              <div className="bar-fill" style={{ width: "38%", background: "var(--text-muted)" }}></div>
            </div>
            <div className="fee">€7,80</div>
          </div>
          <div className="compare-row">
            <div className="name">Western Union</div>
            <div className="bar-wrap">
              <div className="bar-fill" style={{ width: "74%", background: "var(--accent)" }}></div>
            </div>
            <div className="fee">€15,90</div>
          </div>

          <div
            style={{
              marginTop: "16px",
              padding: "14px",
              borderRadius: "var(--r-md)",
              background: "linear-gradient(135deg, var(--primary-soft), transparent)",
              border: "1px solid rgba(45,212,191,0.18)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600 }}>
                Économisé vs Western Union
              </div>
              <div className="mono" style={{ fontSize: "20px", color: "var(--primary)", fontWeight: 600, marginTop: "2px" }}>
                €15,50 · 97 % moins de frais
              </div>
            </div>
            <TrendingUpIcon style={{ width: "28px", height: "28px", color: "var(--primary)", opacity: 0.7 }} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
