"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { grantConsent, revokeConsent } from "@/services/lgpd.actions";

type ConsentType =
  | "terms_of_service"
  | "privacy_policy"
  | "data_processing"
  | "marketing_emails"
  | "analytics_cookies";

export function ConsentToggle({
  type,
  granted,
  version,
  required,
}: {
  type: ConsentType;
  granted: boolean;
  version: string;
  required?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    if (required && granted) {
      toast.error(
        "Esse consentimento é obrigatório pra usar o app. Pra revogar, apague sua conta.",
      );
      return;
    }
    startTransition(async () => {
      const r = granted
        ? await revokeConsent(type, version)
        : await grantConsent(type, version);
      if (r.error) toast.error(r.error);
      else toast.success(granted ? "Consentimento revogado." : "Consentimento registrado.");
      window.location.reload();
    });
  };

  return (
    <Button
      size="sm"
      variant={granted ? "outline" : "primary"}
      onClick={handleToggle}
      disabled={pending}
    >
      {pending ? "..." : granted ? "Revogar" : "Aceitar"}
    </Button>
  );
}
