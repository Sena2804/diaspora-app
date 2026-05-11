"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ComingSoon } from "@/components/coming-soon";
import { ClockIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";

export default function SchedulePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardShell title="Envois programmés" subtitle="Mettre vos transferts en pilote automatique.">
      <ComingSoon
        icon={<ClockIcon style={{ width: 24, height: 24 }} />}
        title="Transferts récurrents et alertes de cours"
        description="Programmez un envoi mensuel à un proche, ou attendez un meilleur taux EUR/XOF pour exécuter automatiquement."
        bullets={[
          "Récurrence mensuelle, hebdomadaire ou ponctuelle",
          "Déclenchement conditionnel sur le taux du marché",
          "Notification SMS / email à chaque exécution",
        ]}
        cta={{ href: "/transfer", label: "Envoi ponctuel maintenant" }}
      />
    </DashboardShell>
  );
}
