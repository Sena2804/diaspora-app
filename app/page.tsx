"use client";

import React, { useState, FormEvent, useEffect } from "react";
import Link from "next/link";
import { 
  Mail, 
  Lock, 
  Eye, 
  ChevronRight
} from "lucide-react";
import styles from "./onboarding.module.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoIcon, SendIcon, ShoppingBagIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [role, setRole] = useState<"sender" | "receiver">("sender");
  const [email, setEmail] = useState("aminata.diallo@gmail.com");
  const [password, setPassword] = useState("password123");
  const [isLoginMode, setIsLoginMode] = useState(true); // true for login, false for signup

  const { isAuthenticated, login, signup } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isLoginMode) {
      const success = login(email, password, role);
      if (!success) {
        alert("Login failed. Check your credentials and role, or sign up.");
      }
    } else {
      const success = signup(email, password, role);
      if (!success) {
        alert("Signup failed. User might already exist.");
      }
    }
  };

  return (
    <main className={styles.onboardingPage}>
      {/* Theme Toggle Positioned Absolutely */}
      <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 50 }}>
        <ThemeToggle />
      </div>

      {/* ════ Hero side ════ */}
      <aside className={styles.heroSide}>
        <div className={styles.brandLine}>
          <div style={{
            width: "38px", 
            height: "38px", 
            display: "grid", 
            placeItems: "center", 
            borderRadius: "11px", 
            background: "linear-gradient(135deg, var(--primary), var(--primary-strong))",
            boxShadow: "0 8px 24px var(--primary-glow)"
          }}>
            <LogoIcon style={{ width: "18px", height: "18px", color: "#042F2E" }} />
          </div>
          <span style={{ fontSize: "17px", fontWeight: 700, letterSpacing: "-0.02em" }}>
            Diaspora<span style={{ color: "var(--primary)" }}>Connect</span>
          </span>
        </div>

        <div>
          <span className="eyebrow" style={{ marginBottom: "18px" }}>ODD&nbsp;10 · Inégalités réduites</span>
          <h1 className={styles.heroHeadline}>
            L'argent qui arrive,<br/>
            <span className={styles.ac}>sans intermédiaire</span><br/>
            <span className={styles.ag}>sans frais cachés.</span>
          </h1>
          <p className={styles.heroSub}>
            Envoyez de l'argent au Bénin avec des frais de <span className="mono" style={{ color: "var(--primary)" }}>0,2 %</span>.
            Smart contract Stellar, off-ramp instantané sur MTN MoMo, Moov Money et Celtiis Cash.
          </p>

          <div className={styles.impactCard}>
            <div className={styles.item}>
              <span className={styles.v}>0,2&nbsp;%</span>
              <span className={styles.l}>Frais effectifs</span>
            </div>
            <div className={styles.item}>
              <span className={styles.v}>3–5&nbsp;s</span>
              <span className={styles.l}>Confirmation Stellar</span>
            </div>
            <div className={styles.item}>
              <span className={styles.v}>€17,60</span>
              <span className={styles.l}>Économisé sur 240€</span>
            </div>
            <div className={styles.item}>
              <span className={styles.v}>82&nbsp;%</span>
              <span className={styles.l}>Adultes Bénin couverts MoMo</span>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "var(--text-tertiary)" }}>
          <span className="pill primary"><span className={styles.dot}></span>Réseau Stellar opérationnel</span>
          <span className="muted">·</span>
          <span className="mono">v0.9.2 · Testnet</span>
        </div>

        {/* Floating proof cards */}
        <div className={`${styles.floatingTx} ${styles.f1}`}>
          <div className={styles.row}>
            <div className={styles.who}>
              <div className={styles.av}>AK</div>
              <div>
                <div className={styles.name}>Akouvi → Cotonou</div>
                <div className={styles.meta}>Il y a 3 minutes</div>
              </div>
            </div>
            <div className={styles.amount} style={{ color: "var(--primary)" }}>+131&nbsp;000&nbsp;XOF</div>
          </div>
          <div className={styles.status}><span className={styles.dot}></span>Confirmé · 0xa3f…b21</div>
        </div>

        <div className={`${styles.floatingTx} ${styles.f2}`}>
          <div className={styles.row}>
            <div className={styles.who}>
              <div className={styles.av}>SD</div>
              <div>
                <div className={styles.name}>Salif → Parakou</div>
                <div className={styles.meta}>Il y a 11 minutes</div>
              </div>
            </div>
            <div className={styles.amount} style={{ color: "var(--accent)" }}>+65&nbsp;500&nbsp;XOF</div>
          </div>
          <div className={styles.status}><span className={styles.dot}></span>Retiré sur MTN MoMo</div>
        </div>
      </aside>

      {/* ════ Auth side ════ */}
      <section className={styles.authSide}>
        <div className={styles.authCard}>
          <span className="eyebrow accent">Bienvenue</span>
          <h2 style={{ fontSize: "30px", fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 6px" }}>
            {isLoginMode ? "Connectez-vous à votre compte" : "Créez votre compte"}
          </h2>
          <p style={{ color: "var(--text-tertiary)", fontSize: "14px", margin: "0 0 28px" }}>
            Choisissez votre rôle pour accéder à l'interface adaptée.
          </p>

          <div className={styles.roleGrid}>
            <button 
              className={`${styles.role} ${role === "sender" ? styles.active : ""}`}
              onClick={() => setRole("sender")}
            >
              <div className={styles.iconCircle}>
                <SendIcon style={{ width: "16px", height: "16px" }} />
              </div>
              <div className={styles.title}>J'envoie</div>
              <div className={styles.sub}>Diaspora · Europe / USA</div>
            </button>
            <button 
              className={`${styles.role} ${styles.accent} ${role === "receiver" ? styles.active : ""}`}
              onClick={() => setRole("receiver")}
            >
              <div className={styles.iconCircle}>
                <ShoppingBagIcon style={{ width: "16px", height: "16px" }} />
              </div>
              <div className={styles.title}>Je reçois</div>
              <div className={styles.sub}>Bénin · Mobile Money</div>
            </button>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div className="field">
              <label>Email ou numéro de téléphone</label>
              <div className="input">
                <Mail style={{ width: "16px", height: "16px", color: "var(--text-tertiary)" }} />
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  required 
                />
              </div>
            </div>
            <div className="field">
              <label style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Mot de passe</span>
                {isLoginMode && (
                  <Link href="#" style={{ color: "var(--primary)", fontWeight: 500, fontSize: "11.5px" }}>
                    Oublié&nbsp;?
                  </Link>
                )}
              </label>
              <div className="input">
                <Lock style={{ width: "16px", height: "16px", color: "var(--text-tertiary)" }} />
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                />
                <Eye style={{ width: "16px", height: "16px", color: "var(--text-tertiary)", cursor: "pointer" }} />
              </div>
            </div>

            <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: "6px" }} type="submit">
              {isLoginMode ? "Se connecter" : "Créer mon compte"}
              <LogoIcon style={{ width: "18px", height: "18px" }} />
            </button>
          </form>

          <div className={styles.dividerText}>Ou continuer avec</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <button className={styles.btnSocial}>
              <svg viewBox="0 0 24 24" style={{ width: "16px", height: "16px" }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.15-4.53H2.18v2.84A11 11 0 0 0 12 23Z"/>
                <path fill="#FBBC05" d="M5.85 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.45.35-2.11V7.05H2.18a11 11 0 0 0 0 9.9l3.67-2.84Z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.05l3.67 2.84C6.71 7.31 9.14 5.38 12 5.38Z"/>
              </svg>
              Google
            </button>
            <button className={styles.btnSocial}>
              <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: "16px", height: "16px" }}>
                <path d="M17.04 12.43c-.03-2.65 2.16-3.93 2.26-3.99-1.23-1.8-3.15-2.05-3.84-2.08-1.63-.16-3.18.96-4.01.96-.84 0-2.1-.94-3.46-.91-1.78.03-3.42 1.04-4.34 2.62-1.85 3.21-.47 7.97 1.33 10.59.88 1.27 1.93 2.7 3.3 2.65 1.32-.05 1.83-.86 3.43-.86 1.6 0 2.05.86 3.45.83 1.42-.02 2.32-1.3 3.19-2.58.99-1.49 1.4-2.93 1.42-3.01-.03-.02-2.74-1.05-2.77-4.18M14.7 4.5c.73-.88 1.22-2.11 1.08-3.34-1.05.04-2.32.7-3.07 1.58-.68.78-1.27 2.04-1.11 3.24 1.17.09 2.37-.6 3.1-1.48"/>
              </svg>
              Apple
            </button>
          </div>

          <div className={styles.authFoot}>
            {isLoginMode ? (
              <>
                Pas encore de compte&nbsp;?{" "}
                <Link href="#" onClick={() => setIsLoginMode(false)}>
                  Créer un compte gratuit
                </Link>
                <br/>
                <span className="dim" style={{ fontSize: "11px" }}>KYC simplifié · 2 minutes · GDPR</span>
              </>
            ) : (
              <>
                Déjà un compte&nbsp;?{" "}
                <Link href="#" onClick={() => setIsLoginMode(true)}>
                  Se connecter
                </Link>
              </>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
