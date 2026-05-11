"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function RechargePage() {
  const { isAuthenticated, loading } = useAuth();
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
    <DashboardShell title="Recharger le portefeuille" subtitle="Ajouter des fonds à votre solde USDC.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Recharger"</h2>
        <p>Ce contenu sera remplacé par les options de rechargement.</p>
      </div>
    </DashboardShell>
  );
}
