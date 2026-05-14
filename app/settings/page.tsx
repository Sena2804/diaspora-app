"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Mail, User, Globe, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";
import { PhoneVerifyModal } from "@/components/phone-verify-modal";
import { COUNTRIES, findCountry, buildFullPhone } from "@/lib/countries";

export default function SettingsPage() {
  const { isAuthenticated, loading, user, logout } = useAuth();
  const router = useRouter();
  const { confirmWithPin } = usePinConfirm();
  const toast = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [countryCode, setCountryCode] = useState("BJ");
  const [phoneLocal, setPhoneLocal] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);

  const country = useMemo(() => findCountry(countryCode)!, [countryCode]);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setCountryCode(user.country ?? "BJ");
    const c = findCountry(user.country ?? "BJ");
    if (user.phone && c && user.phone.startsWith(c.dialCode)) {
      setPhoneLocal(user.phone.slice(c.dialCode.length));
    } else if (user.phone) {
      setPhoneLocal(user.phone);
    } else {
      setPhoneLocal("");
    }
  }, [user]);

  if (loading || !isAuthenticated || !user) return null;

  const phoneValid = phoneLocal.length === 0 || country.phoneRegex.test(phoneLocal.replace(/[\s-]/g, ""));
  const newPhoneFull = phoneLocal.length > 0 ? buildFullPhone(country, phoneLocal.replace(/[\s-]/g, "")) : "";
  const phoneChanged = newPhoneFull !== (user.phone ?? "");
  const dirty =
    firstName !== (user.firstName ?? "") ||
    lastName !== (user.lastName ?? "") ||
    countryCode !== (user.country ?? "BJ") ||
    phoneChanged;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("Prénom et nom requis.");
      return;
    }
    if (phoneLocal.length > 0 && !phoneValid) {
      toast.error(`Format de numéro invalide pour ${country.name}.`);
      return;
    }

    const ok = await confirmWithPin({
      title: "Confirme tes changements",
      subtitle: "Saisis ton PIN pour valider la modification du profil.",
    });
    if (!ok) {
      toast.info("Modification annulée.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, string> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        country: countryCode,
      };
      if (newPhoneFull) payload.phone = newPhoneFull;
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de l'enregistrement.");
        return;
      }
      toast.success("Profil mis à jour.");
      setTimeout(() => window.location.reload(), 700);
    } finally {
      setSaving(false);
    }
  }

  const phoneVerified = user.phoneVerified;
  const hasPhone = !!user.phone;

  return (
    <DashboardShell title="Paramètres" subtitle="Gère ton compte, ton numéro et tes préférences.">
      <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
        <section style={cardStyle()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Vérifications</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <StatusRow ok label="Email" value={user.email} caption="Connexion validée." />
            <StatusRow
              ok={phoneVerified}
              label="Téléphone"
              value={user.phone ?? "Non renseigné"}
              caption={
                !hasPhone
                  ? "Ajoute un numéro ci-dessous pour pouvoir recevoir de l'argent."
                  : phoneVerified
                    ? "Vérifié — tu peux recevoir des transferts."
                    : "Non vérifié — clique pour recevoir le code SMS."
              }
              action={
                hasPhone && !phoneVerified ? (
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setVerifyOpen(true)}>
                    Vérifier
                  </button>
                ) : null
              }
            />
            <StatusRow
              ok={user.kycStatus === "verified"}
              label="Identité (KYC)"
              value={user.kycStatus === "verified" ? "Vérifiée" : "En attente"}
              caption={
                user.kycStatus === "verified"
                  ? "Aucune limite de transfert."
                  : "Limite 500 €/mois tant que la pièce d'identité n'est pas validée."
              }
              action={
                user.kycStatus !== "verified" ? (
                  <a href="/kyc" className="btn btn-primary" style={{ fontSize: 12, padding: "6px 12px" }}>
                    Vérifier
                  </a>
                ) : null
              }
            />
          </div>
        </section>

        <section style={cardStyle()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Mes informations</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 18px" }}>
            La modification est protégée par ton PIN.
          </p>

          <form onSubmit={handleSave} style={{ display: "grid", gap: 14 }}>
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
              <label>Email</label>
              <div className="input">
                <Mail style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                <input type="email" value={user.email} disabled style={{ opacity: 0.6 }} />
              </div>
              <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                L&apos;email n&apos;est pas modifiable ici pour des raisons de sécurité.
              </span>
            </div>

            <div className="field">
              <label>Pays de résidence</label>
              <div className="input">
                <Globe style={{ width: 16, height: 16, color: "var(--text-tertiary)" }} />
                <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} style={{ flex: 1, background: "transparent", border: 0, color: "var(--text-primary)", outline: "none" }}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>
                Téléphone Mobile Money <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>(optionnel)</span>
              </label>
              <div className="input" style={{ paddingLeft: 0 }}>
                <span className="mono" style={{ padding: "0 12px", color: "var(--text-primary)", fontWeight: 600, borderRight: "1px solid var(--border-subtle)", display: "inline-flex", alignItems: "center" }}>
                  {country.flag} {country.dialCode}
                </span>
                <input type="tel" value={phoneLocal} onChange={(e) => setPhoneLocal(e.target.value)} placeholder={country.phonePlaceholder} style={{ paddingLeft: 12 }} />
                {phoneLocal.length > 0 && (phoneValid ? <CheckCircle2 size={16} color="#15803d" /> : <AlertCircle size={16} color="#b91c1c" />)}
              </div>
              <span className="dim" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                {phoneChanged && phoneLocal.length > 0
                  ? "⚠ Changer ton numéro invalide la vérification précédente — tu devras le re-vérifier."
                  : country.phoneHelp}
              </span>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving || !dirty}>
              {saving ? <><Spinner size={14} />Enregistrement…</> : <><Save size={14} />Enregistrer (PIN requis)</>}
            </button>
          </form>
        </section>

        <section style={cardStyle()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Sécurité</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldCheck size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>PIN de sécurité actif</div>
              <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>
                Demandé à la connexion et pour chaque action sensible (envoi, modification d&apos;infos, retrait).
              </div>
            </div>
          </div>
        </section>

        <button onClick={logout} className="btn btn-ghost" style={{ marginTop: 12, justifySelf: "start" }}>
          Se déconnecter
        </button>
      </div>

      <PhoneVerifyModal
        open={verifyOpen}
        phone={user.phone}
        onClose={() => setVerifyOpen(false)}
        onSuccess={() => {
          setVerifyOpen(false);
          setTimeout(() => window.location.reload(), 800);
        }}
      />
    </DashboardShell>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    padding: 22,
    borderRadius: 14,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-subtle)",
  };
}

function StatusRow({ ok, label, value, caption, action }: { ok: boolean; label: string; value: string; caption: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 12, borderRadius: 10, background: "var(--bg-base)", border: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", background: ok ? "rgba(34,197,94,0.12)" : "rgba(251,191,36,0.12)" }}>
        {ok ? <CheckCircle2 size={16} color="#15803d" /> : <AlertCircle size={16} color="#b45309" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{label} · {value}</div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{caption}</div>
      </div>
      {action}
    </div>
  );
}
