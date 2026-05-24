"use server";

import { revalidatePath } from "next/cache";
import { grantConsent as svcGrantConsent, revokeConsent as svcRevokeConsent, requestDataAccess as svcRequestDataAccess } from "@/services/lgpd";

export async function grantConsent(
  type:
    | "terms_of_service"
    | "privacy_policy"
    | "data_processing"
    | "marketing_emails"
    | "analytics_cookies",
  version: string,
) {
  const r = await svcGrantConsent(type, version);
  revalidatePath("/configuracoes/privacidade");
  return r;
}

export async function revokeConsent(
  type:
    | "terms_of_service"
    | "privacy_policy"
    | "data_processing"
    | "marketing_emails"
    | "analytics_cookies",
  version: string,
) {
  const r = await svcRevokeConsent(type, version);
  revalidatePath("/configuracoes/privacidade");
  return r;
}

export async function requestDataAccess(type: "export" | "delete" | "rectify") {
  const r = await svcRequestDataAccess(type);
  revalidatePath("/configuracoes/privacidade");
  return r;
}
