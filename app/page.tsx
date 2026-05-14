"use client";

import React, { useMemo, useState, FormEvent } from "react";
import { Mail, Lock, Eye, EyeOff, User, Calendar, MapPin, Phone, Globe, ArrowLeft, IdCard, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import styles from "./onboarding.module.css";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { COUNTRIES, findCountry, buildFullPhone, type DocumentType } from "@/lib/countries";

type SignupStep = 1 | 2 | 3;
type DocCode = DocumentType["code"];

export default function OnboardingPage() {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);

  // Step 1
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Step 2
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");

  // Step 3
  const [phoneLocal, setPhoneLocal] = useState("");
  const [documentType, setDocumentType] = useState<DocCode>("NPI");
  const [documentNumber, setDocumentNumber] = useState("");

  const country = useMemo(() => findCountry(countryCode)!, [countryCode]);

  // Document type defaults to the first one allowed by the selected country.
  React.useEffect(() => {
    if (!country.documents.find((d) => d.code === documentType)) {
      setDocumentType(country.documents[0].code);
      setDocumentNumber("");
    }
  }, [countryCode]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedDoc = useMemo(
    () => country.documents.find((d) => d.code === documentType) ?? country.documents[0],
    [country, documentType],
  );

  // Live validation
  const phoneValid = phoneLocal.length === 0 || country.phoneRegex.test(phoneLocal.replace(/[\s-]/g, ""));
  const docValid = documentNumber.length === 0 || selectedDoc.regex.test(documentNumber.replace(/\s+/g, ""));

  const { isAuthenticated, loading, login, signup, logout, user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const switchMode = (mode: "login" | "signup") => {
    setIsLoginMode(mode === "login");
    setSignupStep(1);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        toast.error(result.message);
      } else {
        toast.success("Connexion réussie.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep1 = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit faire au moins 8 caractères.");
      return;
    }
    setSignupStep(2);
  };

  const handleStep2 = (event: FormEvent) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Prénom et nom requis.");
      return;
    }
    if (!dateOfBirth) {
      toast.error("Date de naissance requise.");
      return;
    }
    if (!placeOfBirth.trim()) {
      toast.error("Lieu de naissance requis.");
      return;
    }
    setSignupStep(3);
  };

  const handleFinalSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanPhone = phoneLocal.replace(/[\s-]/g, "");
    if (!country.phoneRegex.test(cleanPhone)) {
      toast.error(`Format de numéro invalide pour ${country.name}. Attendu : ${country.phonePlaceholder}.`);
      return;
    }
    const cleanDoc = documentNumber.replace(/\s+/g, "");
    if (!selectedDoc.regex.test(cleanDoc)) {
      toast.error(`Numéro de ${selectedDoc.label} invalide. ${selectedDoc.helpText}`);
      return;
    }

    setSubmitting(true);
    try {
      const result = await signup({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth,
        placeOfBirth: placeOfBirth.trim(),
        phone: buildFullPhone(country, cleanPhone),
        country: countryCode,
        documentType,
        documentNumber: cleanDoc.toUpperCase(),
      });
      if (!result.ok) {
        toast.error(result.message);
        if (result.code === "user_already_exists") {
          setTimeout(() => switchMode("login"), 400);
        }
      } else {
        toast.success("Compte créé ! Vérifie ton email pour activer ton compte.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={styles.onboardingPage}>
      <div style={{ position: "fixed", top: "24px", right: "24px", zIndex: 50 }}>
        <ThemeToggle />
      </div>

      <aside className={styles.heroSide}>
        <div className={styles.brandLine}>
          <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 11, background: "linear-gradient(135deg, var(--primary), var(--primary-strong))", boxShadow: "0 8px 24px var(--primary-glow)" }}>
            <LogoIcon style={{ width: 18, height: 18, color: "#042F2E" }} />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.02em" }}>
            Diaspora<span style={{ color: "var(--primary)" }}>Connect</span>
          </span>
        </div>

        <div>
          <span className="eyebrow" style={{ marginBottom: 18 }}>ODD&nbsp;10 · Inégalités réduites</span>
          <h1 className={styles.heroHeadline}>
            L&apos;argent qui arrive,<br />
            <span className={styles.ac}>sans intermédiaire</span><br />
            <span className={styles.ag}>sans frais cachés.</span>
          </h1>
          <p className={styles.heroSub}>
            Envoyez et recevez de l&apos;argent au Bénin avec des frais de{" "}
            <span className="mono" style={{ color: "var(--primary)" }}>0,2 %</span>. Smart contract Stellar, off-ramp instantané sur MTN MoMo, Moov Money et Celtiis Cash.
          </p>

          <div className={styles.impactCard}>
            <div className={styles.item}><span className={styles.v}>0,2&nbsp;%</span><span className={styles.l}>Frais effectifs</span></div>
            <div className={styles.item}><span className={styles.v}>3–5&nbsp;s</span><span className={styles.l}>Confirmation Stellar</span></div>
            <div className={styles.item}><span className={styles.v}>€17,60</span><span className={styles.l}>Économisé sur 240€</span></div>
            <div className={styles.item}><span className={styles.v}>82&nbsp;%</span><span className={styles.l}>Adultes Bénin MoMo</span></div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12, color: "var(--text-tertiary)" }}>
          <span className="pill primary"><span className={styles.dot}></span>Réseau Stellar opérationnel</span>
          <span className="muted">·</span>
          <span className="mono">v0.9.2 · Testnet</span>
        </div>

        <div className={`${styles.floatingTx} ${styles.f1}`}>
          <div className={styles.row}>
            <div className={styles.who}>
              <div className={styles.av}>AK</div>
              <div><div className={styles.name}>Akouvi → Cotonou</div><div className={styles.meta}>Il y a 3 minutes</div></div>
            </div>
            <div className={styles.amount} style={{ color: "var(--primary)" }}>+131&nbsp;000&nbsp;XOF</div>
          </div>
          <div className={styles.status}><span className={styles.dot}></span>Confirmé · 0xa3f…b21</div>
        </div>

        <div className={`${styles.floatingTx} ${styles.f2}`}>
          <div className={styles.row}>
            <div className={styles.who}>
              <div className={styles.av}>SD</div>
              <div><div className={styles.name}>Salif → Parakou</div><div className={styles.meta}>Il y a 11 minutes</div></div>
            </div>
            <div className={styles.amount} style={{ color: "var(--accent)" }}>+65&nbsp;500&nbsp;XOF</div>
          </div>
          <div className={styles.status}><span className={styles.dot}></span>Retiré sur MTN MoMo</div>
        </div>
      </aside>

      <section className={styles.authSide}>
        {!loading && isAuthenticated && user ? (
          <div className={styles.authCard}>
            <span className="eyebrow accent">Déjà connecté</span>
            <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 6px" }}>Vous êtes connecté</h2>
            <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: "0 0 22px" }}>
              Connecté en tant que <strong style={{ color: "var(--text-primary)" }}>{user.email}</strong>.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              <button className="btn btn-primary btn-lg btn-block" onClick={() => router.push("/dashboard")}>
                Continuer vers mon tableau de bord
              </button>
              <button className="btn btn-ghost btn-block" onClick={async () => { await logout(); toast.info("Déconnecté."); }}>
                Se déconnecter
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.authCard}>
            {isLoginMode ? (
              <>
                <span className="eyebrow accent">Bon retour</span>
                <h2 style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.03em", margin: "8px 0 6px" }}>Connectez-vous</h2>
                <p style={{ color: "var(--text-tertiary)", fontSize: 14, margin: "0 0 24px" }}>
                  Un seul compte. Envoyez et recevez en toute simplicité.
                </p>

                <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="field">
                    <label>Email</label>
                    <div className="input">
                      <Mail style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                  </div>
                  <div className="field">
                    <label>Mot de passe</label>
                    <div className="input">
                      <Lock style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                      <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required />
                      <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Masquer" : "Afficher"} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, display: "flex" }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} type="submit" disabled={submitting}>
                    {submitting ? <><Spinner size={16} color="currentColor" />Connexion…</> : <>Se connecter <LogoIcon style={{ width: 18, height: 18 }} /></>}
                  </button>
                </form>

                <div className={styles.authFoot}>
                  Pas encore de compte ?{" "}
                  <button type="button" onClick={() => switchMode("signup")} style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", padding: 0, font: "inherit" }}>
                    Créer un compte gratuit
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  {signupStep > 1 && (
                    <button type="button" onClick={() => setSignupStep((s) => (s - 1) as SignupStep)} aria-label="Retour" style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--text-tertiary)", display: "flex" }}>
                      <ArrowLeft size={18} />
                    </button>
                  )}
                  <span className="eyebrow accent">Inscription · Étape {signupStep}/3</span>
                </div>

                {/* Progress bar */}
                <div style={{ display: "flex", gap: 4, marginBottom: 18 }}>
                  {[1, 2, 3].map((s) => (
                    <div key={s} style={{ flex: 1, height: 3, borderRadius: 2, background: s <= signupStep ? "var(--primary)" : "var(--border-subtle)", transition: "background 0.2s" }} />
                  ))}
                </div>

                <h2 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.03em", margin: "0 0 6px" }}>
                  {signupStep === 1 && "Créez votre compte"}
                  {signupStep === 2 && "Votre identité"}
                  {signupStep === 3 && "Contact & document"}
                </h2>
                <p style={{ color: "var(--text-tertiary)", fontSize: 13, margin: "0 0 22px" }}>
                  {signupStep === 1 && "Email et mot de passe pour démarrer."}
                  {signupStep === 2 && "Ces infos nous permettent de vérifier votre identité."}
                  {signupStep === 3 && "Numéro Mobile Money et pièce officielle pour valider votre compte."}
                </p>

                {/* ═══════════ STEP 1 ═══════════ */}
                {signupStep === 1 && (
                  <form onSubmit={handleStep1} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div className="field">
                      <label>Email</label>
                      <div className="input">
                        <Mail style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div className="field">
                      <label>Mot de passe (8 caractères minimum)</label>
                      <div className="input">
                        <Lock style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                        <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
                        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Masquer" : "Afficher"} style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-tertiary)", padding: 0, display: "flex" }}>
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} type="submit">Continuer</button>
                  </form>
                )}

                {/* ═══════════ STEP 2 ═══════════ */}
                {signupStep === 2 && (
                  <form onSubmit={handleStep2} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      <div className="field">
                        <label>Prénom</label>
                        <div className="input">
                          <User style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                        </div>
                      </div>
                      <div className="field">
                        <label>Nom</label>
                        <div className="input">
                          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                        </div>
                      </div>
                    </div>

                    <div className="field">
                      <label>Date de naissance</label>
                      <div className="input">
                        <Calendar style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
                      </div>
                    </div>

                    <div className="field">
                      <label>Lieu de naissance</label>
                      <div className="input">
                        <MapPin style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                        <input type="text" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} placeholder="ex. Cotonou, Bénin" required />
                      </div>
                    </div>

                    <div className="field">
                      <label>Pays de résidence</label>
                      <div className="input">
                        <Globe style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                        <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required style={{ flex: 1, background: "transparent", border: 0, color: "var(--text-primary)", outline: "none" }}>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <button className="btn btn-primary btn-lg btn-block" style={{ marginTop: 6 }} type="submit">Continuer</button>
                  </form>
                )}

                {/* ═══════════ STEP 3 ═══════════ */}
                {signupStep === 3 && (
                  <form onSubmit={handleFinalSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Phone with dial code prefix */}
                    <div className="field">
                      <label>Téléphone Mobile Money <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>({country.name})</span></label>
                      <div className="input" style={{ paddingLeft: 0 }}>
                        <span
                          className="mono"
                          style={{
                            padding: "0 12px",
                            color: "var(--text-primary)",
                            fontWeight: 600,
                            borderRight: "1px solid var(--border-subtle)",
                            display: "inline-flex",
                            alignItems: "center",
                            height: "100%",
                          }}
                        >
                          {country.flag} {country.dialCode}
                        </span>
                        <input
                          type="tel"
                          value={phoneLocal}
                          onChange={(e) => setPhoneLocal(e.target.value)}
                          placeholder={country.phonePlaceholder}
                          style={{ paddingLeft: 12 }}
                          required
                        />
                        {phoneLocal.length > 0 && (
                          phoneValid ? (
                            <CheckCircle2 size={16} color="#15803d" />
                          ) : (
                            <AlertCircle size={16} color="#b91c1c" />
                          )
                        )}
                      </div>
                      <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block", color: phoneLocal.length > 0 && !phoneValid ? "#b91c1c" : "var(--text-tertiary)" }}>
                        {country.phoneHelp}
                      </span>
                    </div>

                    {/* Document type selector */}
                    <div className="field">
                      <label>Type de document d&apos;identité</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {country.documents.map((doc) => (
                          <button
                            key={doc.code}
                            type="button"
                            onClick={() => { setDocumentType(doc.code); setDocumentNumber(""); }}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: documentType === doc.code ? "1.5px solid var(--primary)" : "1px solid var(--border-subtle)",
                              background: documentType === doc.code ? "var(--primary-soft)" : "var(--bg-elevated)",
                              color: documentType === doc.code ? "var(--primary)" : "var(--text-primary)",
                              fontSize: 12,
                              fontWeight: documentType === doc.code ? 600 : 400,
                              cursor: "pointer",
                              transition: "all 0.15s",
                            }}
                          >
                            {doc.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Document number input */}
                    <div className="field">
                      <label>Numéro <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>({selectedDoc.label})</span></label>
                      <div className="input">
                        {documentType === "PASSPORT" ? <FileText style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} /> : <IdCard style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />}
                        <input
                          type="text"
                          value={documentNumber}
                          onChange={(e) => setDocumentNumber(e.target.value)}
                          placeholder={selectedDoc.placeholder}
                          required
                          style={{ textTransform: "uppercase" }}
                        />
                        {documentNumber.length > 0 && (
                          docValid ? (
                            <CheckCircle2 size={16} color="#15803d" />
                          ) : (
                            <AlertCircle size={16} color="#b91c1c" />
                          )
                        )}
                      </div>
                      <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block", color: documentNumber.length > 0 && !docValid ? "#b91c1c" : "var(--text-tertiary)" }}>
                        {selectedDoc.helpText}
                      </span>
                    </div>

                    <button
                      className="btn btn-primary btn-lg btn-block"
                      style={{ marginTop: 6 }}
                      type="submit"
                      disabled={submitting || !phoneValid || !docValid || phoneLocal.length === 0 || documentNumber.length === 0}
                    >
                      {submitting ? <><Spinner size={16} color="currentColor" />Création…</> : <>Créer mon compte <LogoIcon style={{ width: 18, height: 18 }} /></>}
                    </button>

                    <p className="dim" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>
                      🔒 Tes informations sont chiffrées et utilisées uniquement pour la conformité KYC (BCEAO). Tu recevras un email pour activer ton compte et un code SMS pour vérifier ton numéro.
                    </p>
                  </form>
                )}

                <div className={styles.authFoot}>
                  Déjà un compte ?{" "}
                  <button type="button" onClick={() => switchMode("login")} style={{ background: "none", border: 0, color: "var(--primary)", cursor: "pointer", padding: 0, font: "inherit" }}>
                    Se connecter
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
