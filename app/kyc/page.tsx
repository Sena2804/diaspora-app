"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileImage, IdCard, ShieldCheck, X, CheckCircle2, AlertCircle, Camera } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { usePinConfirm } from "@/components/pin-gate";
import { createClient } from "@/lib/supabase/client";
import { findCountry } from "@/lib/countries";

type Slot = "recto" | "verso" | "selfie";

interface UploadState {
  uploading: boolean;
  path: string | null;
  preview: string | null;
}

const EMPTY: UploadState = { uploading: false, path: null, preview: null };

export default function KycPage() {
  const { isAuthenticated, loading, user } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const toast = useToast();
  const { confirmWithPin } = usePinConfirm();

  const [recto, setRecto] = useState<UploadState>(EMPTY);
  const [verso, setVerso] = useState<UploadState>(EMPTY);
  const [selfie, setSelfie] = useState<UploadState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated || !user) return null;

  const country = findCountry(user.country ?? "BJ");
  const docLabel =
    country?.documents.find((d) => d.code === user.documentType)?.label ??
    "Document d'identité";

  const alreadyVerified = user.kycStatus === "verified";

  async function uploadFile(slot: Slot, file: File) {
    if (!user) return;
    const setter = slot === "recto" ? setRecto : slot === "verso" ? setVerso : setSelfie;
    setter({ uploading: true, path: null, preview: URL.createObjectURL(file) });
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `${user.id}/${slot}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("kyc")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (error) {
      toast.error(`Upload échoué (${slot}) : ${error.message}`);
      setter(EMPTY);
      return;
    }
    setter({ uploading: false, path, preview: URL.createObjectURL(file) });
    toast.success(`${slot === "recto" ? "Recto" : slot === "verso" ? "Verso" : "Selfie"} uploadé.`);
  }

  async function handleSubmit() {
    if (!recto.path) {
      toast.error("Le recto est obligatoire.");
      return;
    }
    const ok = await confirmWithPin({
      title: "Confirme l'envoi de ta pièce",
      subtitle: "Tes documents seront associés à ton identité de manière permanente.",
    });
    if (!ok) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recto_path: recto.path,
          verso_path: verso.path ?? undefined,
          selfie_path: selfie.path ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Échec de la soumission.");
        return;
      }
      toast.success("Identité vérifiée ! Aucune limite de transfert.");
      setTimeout(() => window.location.assign("/account"), 1000);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DashboardShell
      title="Vérification d'identité"
      subtitle="Téléverse ta pièce officielle pour lever la limite mensuelle de 500 €."
    >
      <div style={{ display: "grid", gap: 18, maxWidth: 760 }}>
        {alreadyVerified && (
          <div
            style={{
              padding: 16,
              borderRadius: 12,
              background: "rgba(34,197,94,0.10)",
              border: "1px solid rgba(34,197,94,0.35)",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <ShieldCheck size={22} color="#15803d" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#15803d" }}>Identité déjà vérifiée</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Tu peux re-soumettre tes documents si tu souhaites les mettre à jour.
              </div>
            </div>
          </div>
        )}

        {/* Document déclaré au signup (read-only) */}
        <section style={cardStyle()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 14px" }}>Pièce déclarée à l&apos;inscription</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, background: "var(--bg-base)" }}>
            <IdCard size={20} color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{docLabel}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                {user.documentNumber ?? "—"}
              </div>
            </div>
            <a href="/settings" style={{ fontSize: 11, color: "var(--text-tertiary)", textDecoration: "underline" }}>Modifier dans Paramètres</a>
          </div>
        </section>

        {/* Uploads */}
        <section style={cardStyle()}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>Téléverse ta pièce</h3>
          <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: "0 0 16px" }}>
            Photos nettes, sans reflet. JPG, PNG ou PDF jusqu&apos;à 5 Mo.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <UploadField
              icon={<FileImage size={16} />}
              label="Recto de la pièce"
              required
              state={recto}
              onFile={(f) => uploadFile("recto", f)}
              onClear={() => setRecto(EMPTY)}
            />
            <UploadField
              icon={<FileImage size={16} />}
              label="Verso de la pièce"
              hint="Optionnel pour les passeports (qui n'ont qu'un recto utile)."
              state={verso}
              onFile={(f) => uploadFile("verso", f)}
              onClear={() => setVerso(EMPTY)}
            />
            <UploadField
              icon={<Camera size={16} />}
              label="Selfie avec ta pièce"
              hint="Optionnel mais recommandé — sécurité renforcée."
              state={selfie}
              onFile={(f) => uploadFile("selfie", f)}
              onClear={() => setSelfie(EMPTY)}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !recto.path || recto.uploading || verso.uploading || selfie.uploading}
            className="btn btn-primary btn-lg"
            style={{ marginTop: 20 }}
          >
            {submitting ? <><Spinner size={14} />Envoi…</> : <><ShieldCheck size={16} />Soumettre pour vérification (PIN requis)</>}
          </button>

          <p className="dim" style={{ fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
            🔒 Tes documents sont chiffrés au repos, stockés dans un bucket privé Supabase, et ne sont consultables que par toi et notre équipe conformité (BCEAO).
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}

function UploadField({
  icon,
  label,
  hint,
  required,
  state,
  onFile,
  onClear,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  required?: boolean;
  state: UploadState;
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const inputId = `upload-${label.replace(/\s+/g, "-")}`;
  return (
    <div style={{ padding: 14, borderRadius: 10, border: `1px ${state.path ? "solid" : "dashed"} ${state.path ? "var(--primary)" : "var(--border-subtle)"}`, background: state.path ? "var(--primary-soft)" : "var(--bg-base)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 13, fontWeight: 600 }}>
          {label} {required && <span style={{ color: "#b91c1c" }}>*</span>}
        </span>
        {state.path && <CheckCircle2 size={16} color="#15803d" style={{ marginLeft: "auto" }} />}
      </div>
      {hint && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginBottom: 8 }}>{hint}</div>}

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {state.preview ? (
          <div style={{ position: "relative", width: 70, height: 70, borderRadius: 8, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.preview} alt="preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            {state.uploading && (
              <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center" }}>
                <Spinner size={20} color="#fff" />
              </div>
            )}
          </div>
        ) : (
          <div style={{ width: 70, height: 70, borderRadius: 8, background: "var(--bg-elevated)", border: "1px dashed var(--border-subtle)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Upload size={20} color="var(--text-tertiary)" />
          </div>
        )}
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          <input
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <label htmlFor={inputId} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", cursor: "pointer" }}>
            {state.path ? "Remplacer" : "Choisir un fichier"}
          </label>
          {state.path && (
            <button type="button" onClick={onClear} className="btn" style={{ fontSize: 12, padding: "6px 10px", color: "#b91c1c", border: "1px solid rgba(185,28,28,0.3)" }}>
              <X size={12} /> Retirer
            </button>
          )}
        </div>
      </div>
    </div>
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
