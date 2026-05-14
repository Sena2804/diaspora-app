"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Check, Share2, Download, ShieldCheck, ShieldAlert, Phone, Mail, Globe, IdCard } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/toast";

export default function AccountPage() {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  React.useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  const walletId = user?.walletId ?? null;

  // The QR encodes a deep-link so a phone camera scan opens the send page
  // pre-filled. If someone scans inside the app, the /transfer page will
  // read the `to` query param.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = useMemo(() => {
    if (!walletId) return "";
    return `${appUrl}/transfer?to=${encodeURIComponent(walletId)}`;
  }, [walletId, appUrl]);

  const displayName = useMemo(() => {
    if (user?.firstName || user?.lastName) {
      return [user.firstName, user.lastName].filter(Boolean).join(" ");
    }
    return user?.email?.split("@")[0] ?? "—";
  }, [user]);

  async function copyWalletId() {
    if (!walletId) return;
    try {
      await navigator.clipboard.writeText(walletId);
      setCopied(true);
      toast.success("Identifiant copié.");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Impossible de copier. Sélectionne le texte manuellement.");
    }
  }

  function shareWhatsApp() {
    if (!walletId) return;
    const text = `Salut ! Tu peux m'envoyer de l'argent via DiasporaConnect avec mon identifiant : ${walletId}\nOu scanne mon QR : ${qrValue}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener");
  }

  function downloadQR() {
    const canvas = document.querySelector<HTMLCanvasElement>("#wallet-qr canvas");
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `diasporaconnect-${walletId ?? "qr"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  if (loading || !isAuthenticated) return null;

  const kycVerified = user?.kycStatus === "verified";

  return (
    <DashboardShell
      title="Mon compte"
      subtitle="Partage cet identifiant pour recevoir de l'argent. Ton numéro de téléphone reste privé."
    >
      <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>
        {/* ============================ Wallet card ============================ */}
        <section
          style={{
            padding: 28,
            borderRadius: 18,
            background: "linear-gradient(135deg, var(--bg-elevated), var(--bg-base))",
            border: "1px solid var(--primary)",
            boxShadow: "0 0 0 3px var(--primary-soft)",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 28,
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text-tertiary)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: 8,
              }}
            >
              Mon identifiant DiasporaConnect
            </div>
            <div
              className="mono"
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: "0.04em",
                color: "var(--primary)",
                wordBreak: "break-all",
              }}
            >
              {walletId ?? "…"}
            </div>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={copyWalletId}
                disabled={!walletId}
                style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copié" : "Copier l'identifiant"}
              </button>
              <button
                className="btn"
                onClick={shareWhatsApp}
                disabled={!walletId}
                style={{
                  fontSize: 13,
                  padding: "8px 14px",
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.3)",
                  color: "#15803d",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Share2 size={14} />
                Partager via WhatsApp
              </button>
              <button
                className="btn"
                onClick={downloadQR}
                disabled={!walletId}
                style={{ fontSize: 13, padding: "8px 14px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Download size={14} />
                Télécharger le QR
              </button>
            </div>
          </div>

          <div
            id="wallet-qr"
            style={{
              padding: 12,
              background: "#fff",
              borderRadius: 12,
              display: "grid",
              placeItems: "center",
            }}
          >
            {walletId ? (
              <QRCodeCanvas value={qrValue} size={148} level="M" includeMargin={false} />
            ) : (
              <div style={{ width: 148, height: 148, background: "#f3f4f6" }} />
            )}
          </div>
        </section>

        {/* ============================ Info banner ============================ */}
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "rgba(45,212,191,0.10)",
            border: "1px solid rgba(45,212,191,0.3)",
            color: "var(--text-secondary)",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          🔒 <strong>Pourquoi un identifiant et pas mon numéro ?</strong>
          {" "}Ton numéro de téléphone sert uniquement à recevoir le retrait Mobile Money — il reste privé.
          Ton identifiant DiasporaConnect, lui, peut être partagé librement.
          Si quelqu&apos;un le découvre, le pire qu&apos;il puisse faire c&apos;est… te faire un cadeau.
        </div>

        {/* ============================ Profile info ============================ */}
        <section
          style={{
            padding: 22,
            borderRadius: 14,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Informations personnelles</h3>
            <a
              href="/settings"
              style={{
                fontSize: 12,
                color: "var(--primary)",
                textDecoration: "none",
              }}
            >
              Modifier →
            </a>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <InfoRow icon={<IdCard size={14} />} label="Nom" value={displayName} />
            <InfoRow icon={<Mail size={14} />} label="Email" value={user?.email ?? "—"} />
            <InfoRow
              icon={<Phone size={14} />}
              label="Téléphone"
              value={
                user?.phone
                  ? `${user.phone}${user.phoneVerified ? " ✓" : " (non vérifié)"}`
                  : "Non renseigné"
              }
            />
            <InfoRow icon={<Globe size={14} />} label="Pays" value={user?.country ?? "—"} />
          </div>

          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px dashed var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {kycVerified ? (
              <>
                <ShieldCheck size={18} color="#15803d" />
                <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>
                  Identité vérifiée
                </span>
                <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                  Aucune limite de transfert mensuelle.
                </span>
              </>
            ) : (
              <>
                <ShieldAlert size={18} color="#b45309" />
                <span style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}>
                  Vérification en attente
                </span>
                <a
                  href="/settings"
                  style={{
                    fontSize: 12,
                    color: "var(--primary)",
                    marginLeft: "auto",
                    textDecoration: "none",
                  }}
                >
                  Vérifier mon identité →
                </a>
              </>
            )}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{value}</div>
    </div>
  );
}
