import { redirect } from "next/navigation";

/**
 * /orcamento foi absorvido por /categorias?view=orcamento — orçamento é a mesma
 * entidade que categoria (categoria + seu teto), então virou uma lente (pill) da
 * página de categorias. Redirect preserva bookmarks e links antigos.
 */
export default function OrcamentoRedirect() {
  redirect("/categorias?view=orcamento");
}
