/**
 * Geo coarse (só o PAÍS) pra landing escolher o idioma por localização quando o
 * navegador não resolve. Vem do header da Vercel — sem IP, sem PII, sem cookie.
 */
export default function handler(req, res) {
  const country = String(req.headers["x-vercel-ip-country"] || "").slice(0, 2).toUpperCase();
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({ country: country || null });
}
