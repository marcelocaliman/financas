/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem chave de API.
 *
 * Política de uso do Nominatim (https://operations.osmfoundation.org/policies/nominatim/):
 *   - Max 1 req/sec
 *   - User-Agent obrigatório identificando o app
 *   - Não consultar o mesmo endereço repetidamente (cachear no client)
 */

export type GeocodeResult = {
  latitude: number;
  longitude: number;
  display_name: string;
  country_code: string | null; // ISO 3166-1 alpha-2 lowercase
};

/**
 * Resolve "Lisboa, Portugal" → {lat, lng, country_code: "pt"}.
 * Retorna null se não achou nada.
 */
export async function geocodeDestination(
  query: string,
): Promise<GeocodeResult | null> {
  const trimmed = query.trim();
  if (!trimmed) return null;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", trimmed);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR,pt,en");

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Financas-App (https://nossasfinancas.com.br)",
      },
      // Edge-cache pra não bater limit
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      address?: { country_code?: string };
    }>;
    if (!data.length) return null;
    const r = data[0];
    return {
      latitude: parseFloat(r.lat),
      longitude: parseFloat(r.lon),
      display_name: r.display_name,
      country_code: r.address?.country_code ?? null,
    };
  } catch {
    return null;
  }
}
