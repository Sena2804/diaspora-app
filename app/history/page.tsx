"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HistoryPage() {
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
    <DashboardShell title="Historique des transferts" subtitle="Consulter le détail de vos transactions.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Historique"</h2>
        <p>Ce contenu sera remplacé par la liste des transactions.</p>
      </div>
    </DashboardShell>
  );
}
