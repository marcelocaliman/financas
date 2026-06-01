import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * /relatorios foi fundido em /analise (Histórico → visão "Ano"). Mantém o
 * redirect pra links antigos, atalhos e bookmarks continuarem funcionando,
 * preservando o ano se vier na query.
 */
export default async function RelatoriosRedirect({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year } = await searchParams;
  redirect(year ? `/analise?view=ano&year=${year}` : "/analise?view=ano");
}
