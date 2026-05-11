"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TransferPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null;
  }
  return (
    <DashboardShell title="Nouvel envoi" subtitle="Envoyer de l'argent au Bénin.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Nouvel envoi"</h2>
        <p>Ce contenu sera remplacé par le formulaire d'envoi d'argent.</p>
      </div>
    </DashboardShell>
  );
}
