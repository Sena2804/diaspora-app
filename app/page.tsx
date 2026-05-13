"use client";

import React, { useState, FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import styles from "./onboarding.module.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoIcon, SendIcon, ShoppingBagIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const [role, setRole] = useState<"sender" | "receiver">("sender");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true); // true for login, false for signup

  const { isAuthenticated, loading, login, signup, logout, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoginMode && role === "receiver" && !phone.trim()) {
      toast.error("Le numéro de téléphone est requis pour recevoir des transferts.");
      return;
    }
    setSubmitting(true);
    try {
      const result = isLoginMode
        ? await login(email, password, role)
        : await signup(email, password, role, phone.trim() || undefined);
      if (!result.ok) {
        toast.error(result.message);
        // If signup failed because user exists, suggest switching to login
        if (result.code === "user_already_exists") {
          setTimeout(() => setIsLoginMode(true), 400);
        }
      } else if (!isLoginMode) {
        toast.success("Bienvenue ! Compte créé avec succès.");
      } else {
        toast.success("Connexion réussie.");
      }
    } finally {
      setSubmitting(false);
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
        {!loading && isAuthenticated && user ? (
          <div className={styles.authCard}>
            <span className="eyebrow accent">Déjà connecté</span>
            <h2 style={{ fontSize: "26px", fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 6px" }}>
              Vous êtes connecté
            </h2>
            <p style={{ color: "var(--text-tertiary)", fontSize: "14px", margin: "0 0 22px" }}>
              Connecté en tant que{" "}
              <strong style={{ color: "var(--text-primary)" }}>{user.email}</strong>
              {" — "}
              {user.role === "receiver" ? "Bénéficiaire" : "Expéditeur"}.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <button
                className="btn btn-primary btn-lg btn-block"
                onClick={() => router.push(user.role === "receiver" ? "/wallet" : "/dashboard")}
              >
                Continuer vers {user.role === "receiver" ? "mon portefeuille" : "mon tableau de bord"}
              </button>
              <button
                className="btn btn-ghost btn-block"
                onClick={async () => {
                  await logout();
                  toast.info("Déconnecté. Vous pouvez créer un autre compte.");
                }}
              >
                Se déconnecter pour changer de compte
              </button>
            </div>
            <div className={styles.authFoot} style={{ marginTop: 20 }}>
              <span className="dim" style={{ fontSize: 11 }}>
                Vous ne pouvez créer un autre compte qu'après déconnexion.
              </span>
            </div>
          </div>
        ) : (
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
            {!isLoginMode && role === "receiver" && (
              <div className="field">
                <label>Numéro Mobile Money (format +229…)</label>
                <div className="input">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+22997123456"
                    required
                  />
                </div>
                <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                  Ce numéro reliera votre compte aux transferts entrants.
                </span>
              </div>
            )}
            <div className="field">
              <label>
                <span>Mot de passe</span>
              </label>
              <div className="input">
                <Lock style={{ width: "16px", height: "16px", color: "var(--text-tertiary)" }} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  style={{
                    border: 0,
                    background: "transparent",
                    cursor: "pointer",
                    color: "var(--text-tertiary)",
                    padding: 0,
                    display: "flex",
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              className="btn btn-primary btn-lg btn-block"
              style={{ marginTop: "6px" }}
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Spinner size={16} color="currentColor" />
                  {isLoginMode ? "Connexion…" : "Création…"}
                </>
              ) : (
                <>
                  {isLoginMode ? "Se connecter" : "Créer mon compte"}
                  <LogoIcon style={{ width: "18px", height: "18px" }} />
                </>
              )}
            </button>
          </form>

          <div className={styles.authFoot}>
            {isLoginMode ? (
              <>
                Pas encore de compte&nbsp;?{" "}
                <button
                  type="button"
                  onClick={() => setIsLoginMode(false)}
                  style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", padding: 0, font: "inherit" }}
                >
                  Créer un compte gratuit
                </button>
                <br/>
                <span className="dim" style={{ fontSize: "11px" }}>KYC simplifié · 2 minutes · GDPR</span>
              </>
            ) : (
              <>
                Déjà un compte&nbsp;?{" "}
                <button
                  type="button"
                  onClick={() => setIsLoginMode(true)}
                  style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", padding: 0, font: "inherit" }}
                >
                  Se connecter
                </button>
              </>
            )}
          </div>
        </div>
        )}
      </section>
    </main>
  );
}
