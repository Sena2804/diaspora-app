"use client";

import React, { useEffect } from "react";
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
  TrendingUpIcon
} from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function DashboardPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push("/");
    }
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <DashboardShell 
      title={`Bonjour ${user?.email.split('@')[0]} 👋`}
      subtitle={
        <>Vous avez économisé <span style={{ color: "var(--primary)" }} className="mono">€87,40</span> de frais ce mois-ci. Voici un résumé.</>
      }
    >
      {/* Top row : hero balance + KPIs */}
      <div className={styles.grid2}>
        {/* Hero card */}
        <div className={styles.heroCard}>
          <div className={styles.heroBalance}>
            <div>
              <div className={styles.label}>Solde wallet</div>
              <div className={styles.value}>2&nbsp;480<span className={styles.currency}>USDC</span></div>
              <div className={styles.convert}>≈ €2 296,40 · 1 USDC = 0,9260 €</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
              <span className="pill primary"><span className="dot pulse"></span>Connecté · Stellar Mainnet</span>
              <span className="hash">
                <LinkIcon style={{ width: "11px", height: "11px" }} />
                GBKL…JX9F
              </span>
            </div>
          </div>

          <div className={styles.actionsRow}>
            <Link href="/transfer" className="btn btn-primary btn-lg">
              <ArrowRightIcon strokeWidth={2.4} style={{ width: "16px", height: "16px" }} />
              Envoyer au Bénin
            </Link>
            <Link href="/recharge" className="btn btn-ghost btn-lg">
              <PlusIcon style={{ width: "16px", height: "16px" }} />
              Recharger
            </Link>
            <Link href="/schedule" className="btn btn-ghost btn-lg">
              <ClockIcon style={{ width: "16px", height: "16px" }} />
              Programmer
            </Link>
          </div>

          <div className={styles.impactStrip}>
            <div className={styles.left}>
              <div className={styles.ribbonIc}>
                <ActivityIcon style={{ width: "18px", height: "18px" }} />
              </div>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 600 }}>Impact ODD&nbsp;10 — vos économies</div>
                <div style={{ fontSize: "11.5px", color: "var(--text-tertiary)" }}>Vs services traditionnels (8–12 % moyen)</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="mono" style={{ fontSize: "22px", fontWeight: 600, color: "var(--primary)" }}>€87,40</div>
              <div style={{ fontSize: "11px", color: "var(--text-tertiary)" }} className="mono">7 transferts · ce mois</div>
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
            <div className={styles.v}>€1 240</div>
            <div className={styles.delta}>
              <TrendingUpIcon style={{ width: "10px", height: "10px" }} />
              +18 % vs avril
            </div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Frais payés</span>
              <div className={styles.ic} style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
                <DollarSignIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>€2,48</div>
            <div className={styles.delta}>0,2 % effectif</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Délai moyen</span>
              <div className={styles.ic} style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <ClockIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>4,2 s</div>
            <div className={styles.delta}>Stellar testnet</div>
          </div>
          <div className={styles.statTile}>
            <div className={styles.head}>
              <span className={styles.lbl}>Bénéficiaires</span>
              <div className={styles.ic} style={{ background: "rgba(167,139,250,0.12)", color: "#A78BFA" }}>
                <UsersIcon style={{ width: "14px", height: "14px" }} />
              </div>
            </div>
            <div className={styles.v}>5</div>
            <div className={styles.delta}>3 actifs ce mois</div>
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

          <div className={styles.recentTx}>
            <div className={styles.av}>FK</div>
            <div className={styles.info}>
              <div className={styles.name}>Fatou Kpogan · Cotonou</div>
              <div className={styles.sub}>
                <span className="mono">→ +229 91 23 45 67</span>
                · MTN MoMo
                <span className="pill success" style={{ padding: "1px 7px", fontSize: "10px" }}><span className="dot"></span>Retiré</span>
              </div>
            </div>
            <div className={styles.right}>
              <div className={styles.amt} style={{ color: "var(--success)" }}>−€100,00</div>
              <div className={styles.metaR}>65 500 XOF · il y a 2h</div>
            </div>
          </div>

          <div className={`${styles.recentTx} ${styles.t2}`}>
            <div className={styles.av}>EA</div>
            <div className={styles.info}>
              <div className={styles.name}>Edwige Adjovi · Porto-Novo</div>
              <div className={styles.sub}>
                <span className="mono">→ +229 96 14 88 02</span>
                · Moov Money
                <span className="pill primary" style={{ padding: "1px 7px", fontSize: "10px" }}><span className="dot pulse"></span>En attente retrait</span>
              </div>
            </div>
            <div className={styles.right}>
              <div className={styles.amt} style={{ color: "var(--success)" }}>−€200,00</div>
              <div className={styles.metaR}>131 000 XOF · hier</div>
            </div>
          </div>

          <div className={`${styles.recentTx} ${styles.t3}`}>
            <div className={styles.av}>SD</div>
            <div className={styles.info}>
              <div className={styles.name}>Salif Dossou · Parakou</div>
              <div className={styles.sub}>
                <span className="mono">→ +229 97 51 32 19</span>
                · Celtiis Cash
                <span className="pill success" style={{ padding: "1px 7px", fontSize: "10px" }}><span className="dot"></span>Retiré</span>
              </div>
            </div>
            <div className={styles.right}>
              <div className={styles.amt} style={{ color: "var(--success)" }}>−€150,00</div>
              <div className={styles.metaR}>98 250 XOF · 03/05</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className={styles.sectionHead}>
            <h3>Vous économisez sur chaque envoi</h3>
            <span className="pill primary"><span className="dot"></span>Live</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--text-tertiary)", margin: "0 0 14px" }}>
            Pour <span className="mono" style={{ color: "var(--text-primary)" }}>€200</span> envoyés vers le Bénin :
          </p>

          <div className="compare-row us">
            <div className="name">
              <span className="dot" style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "currentColor" }}></span>
              DiasporaConnect
            </div>
            <div className="bar-wrap"><div className="bar-fill" style={{ width: "5%", background: "var(--primary)" }}></div></div>
            <div className="fee">€0,40</div>
          </div>
          <div className="compare-row">
            <div className="name">Wise</div>
            <div className="bar-wrap"><div className="bar-fill" style={{ width: "38%", background: "var(--text-muted)" }}></div></div>
            <div className="fee">€7,80</div>
          </div>
          <div className="compare-row">
            <div className="name">Western Union</div>
            <div className="bar-wrap"><div className="bar-fill" style={{ width: "74%", background: "var(--accent)" }}></div></div>
            <div className="fee">€15,90</div>
          </div>

          <div style={{ marginTop: "16px", padding: "14px", borderRadius: "var(--r-md)", background: "linear-gradient(135deg, var(--primary-soft), transparent)", border: "1px solid rgba(45,212,191,0.18)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-tertiary)", fontWeight: 600 }}>Économisé vs Western Union</div>
              <div className="mono" style={{ fontSize: "20px", color: "var(--primary)", fontWeight: 600, marginTop: "2px" }}>€15,50 · 97 % moins de frais</div>
            </div>
            <TrendingUpIcon style={{ width: "28px", height: "28px", color: "var(--primary)", opacity: 0.7 }} />
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}