"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BlockchainPage() {
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
    <DashboardShell title="Mes preuves blockchain" subtitle="Visualiser vos transactions on-chain.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Mes preuves blockchain"</h2>
        <p>Ce contenu sera remplacé par l'explorateur de transactions.</p>
      </div>
    </DashboardShell>
  );
}
