import { redirect } from "next/navigation";

/**
 * /assinaturas foi consolidado em /recorrentes?view=subscriptions.
 * Redirect permanente preserva bookmarks e links antigos.
 */
export default function AssinaturasRedirect() {
  redirect("/recorrentes?view=subscriptions");
}
