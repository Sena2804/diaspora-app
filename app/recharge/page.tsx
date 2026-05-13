"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardShell } from "@/components/dashboard-shell";
import { ComingSoon } from "@/components/coming-soon";
import { PlusIcon } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";

export default function RechargePage() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) router.push("/");
  }, [loading, isAuthenticated, router]);

  if (loading || !isAuthenticated) return null;

  return (
    <DashboardShell title="Recharger le wallet" subtitle="Approvisionner votre wallet pour vos prochains envois.">
      <ComingSoon
        icon={<PlusIcon style={{ width: 24, height: 24 }} />}
        title="Recharge directe depuis votre carte"
        description="On-ramp Stripe / SEPA pour convertir vos EUR en USDC sur votre wallet Stellar en moins d'une minute."
        bullets={[
          "Carte bancaire ou virement SEPA",
          "Conversion automatique EUR → USDC sur Stellar",
          "Pas d'inscription supplémentaire (KYC déjà fait)",
        ]}
        cta={{ href: "/transfer", label: "Faire un envoi maintenant" }}
      />
    </DashboardShell>
  );
}
