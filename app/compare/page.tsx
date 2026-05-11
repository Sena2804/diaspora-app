"use client";

import { DashboardShell } from "@/components/dashboard-shell";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ComparePage() {
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
    <DashboardShell title="Comparateur de frais" subtitle="Comparer les frais avec les services traditionnels.">
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Page "Comparateur frais"</h2>
        <p>Ce contenu sera remplacé par l'outil de comparaison.</p>
      </div>
    </DashboardShell>
  );
}
