"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import type { Tables } from "@/types/database";

type Cat = Pick<Tables<"categories">, "id" | "name" | "kind">;
type Acc = Pick<Tables<"accounts">, "id" | "name" | "institution">;

/**
 * Builder de export customizado de transactions em CSV. Permite escolher
 * período, categoria, conta, tipo. Gera link que aciona o endpoint
 * /api/transactions/export.
 */
export function CustomExportBuilder({
  categories,
  accounts,
  defaultYear,
}: {
  categories: Cat[];
  accounts: Acc[];
  defaultYear: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(`${defaultYear}-01-01`);
  const [to, setTo] = useState(today < `${defaultYear}-12-31` ? today : `${defaultYear}-12-31`);
  const [kind, setKind] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [accountId, setAccountId] = useState<string>("all");

  const buildUrl = () => {
    const sp = new URLSearchParams();
    sp.set("from", from);
    sp.set("to", to);
    if (kind !== "all") sp.set("kind", kind);
    if (categoryId !== "all") sp.set("categoryId", categoryId);
    if (accountId !== "all") sp.set("accountId", accountId);
    return `/api/transactions/export?${sp.toString()}`;
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="De" htmlFor="export-from">
          <Input
            id="export-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </Field>
        <Field label="Até" htmlFor="export-to">
          <Input
            id="export-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Tipo" htmlFor="export-kind">
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger id="export-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="income">Receitas</SelectItem>
              <SelectItem value="expense">Despesas</SelectItem>
              <SelectItem value="transfer">Transferências</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Categoria" htmlFor="export-category">
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger id="export-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Conta" htmlFor="export-account">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger id="export-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.institution} · {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            window.location.href = buildUrl();
          }}
        >
          <Download className="w-3.5 h-3.5" strokeWidth={1.7} />
          Baixar CSV filtrado
        </Button>
      </div>
    </div>
  );
}
