/**
 * Util CLI pra preview de templates de email. Usa o mesmo wrapEmail/components
 * que o sistema, gera o HTML resultante e (opcionalmente) envia via Resend.
 *
 * Uso:
 *   pnpm exec vitest run --reporter=verbose scripts/preview-email.ts (não funciona)
 *
 * Vou rodar como teste via vitest mesmo — temos a infra montada.
 */
import { describe, it, expect } from "vitest";
import {
  tmplAccountantInvite,
  tmplAccountantAccessNotification,
  tmplDarfDue,
  tmplCronStale,
} from "@/services/email";
import fs from "node:fs";
import path from "node:path";

describe("Email templates preview", () => {
  it("gera HTMLs e salva em /tmp/email-previews pra abrir no browser", () => {
    const outDir = "/tmp/email-previews";
    fs.mkdirSync(outDir, { recursive: true });

    const templates = [
      {
        name: "1-accountant-invite",
        tmpl: tmplAccountantInvite({
          inviterName: "Marcelo Caliman",
          householdName: "Caliman",
          inviteUrl: "https://nossasfinancas.com.br/contador/aceitar?token=abc123demo",
          years: [2024, 2025],
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      },
      {
        name: "2-accountant-access",
        tmpl: tmplAccountantAccessNotification({
          accountantName: "João Silva (CRC-SP 123456)",
          householdName: "Caliman",
          action: "export_dec",
          year: 2024,
          ip: "189.10.20.30",
        }),
      },
      {
        name: "3-darf-due",
        tmpl: tmplDarfDue({
          amount: 1234.56,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          kind: "Swing trade (ações)",
        }),
      },
      {
        name: "4-cron-stale",
        tmpl: tmplCronStale({
          staleChecks: [
            {
              name: "Indexadores BCB",
              description: "Selic, CDI, IPCA · /api/cron/update-indexers",
              ageHours: 72,
              staleAfterHours: 72,
            },
            {
              name: "Taxas de câmbio",
              description: "USD/EUR/BRL · /api/cron/update-rates",
              ageHours: 96,
              staleAfterHours: 72,
            },
          ],
        }),
      },
    ];

    for (const { name, tmpl } of templates) {
      const filePath = path.join(outDir, `${name}.html`);
      fs.writeFileSync(filePath, tmpl.body);
      expect(tmpl.body.length).toBeGreaterThan(500);
      expect(tmpl.body).toContain("nossasfinancas.com.br");
      expect(tmpl.subject.length).toBeGreaterThan(5);
    }

    console.log(`\n  ✓ Previews salvos em ${outDir}/\n`);
  });
});
