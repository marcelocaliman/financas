"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Sparkles, Search, ChevronLeft, ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCategoryRule,
  deleteCategoryRule,
  applyRulesToUncategorized,
} from "@/services/category-rules.actions";
import { useConfirm } from "@/components/ui/confirm-dialog";
import type { CategoryRule } from "@/services/category-rules";
import type { Tables } from "@/types/database";

type Cat = Tables<"categories">;

export function CategoryRulesManager({
  initialRules,
  categories,
}: {
  initialRules: CategoryRule[];
  categories: Cat[];
}) {
  const [adding, setAdding] = useState(false);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [kind, setKind] = useState<"income" | "expense" | "transfer">("expense");
  const [pending, startTransition] = useTransition();
  const [applying, startApplying] = useTransition();
  const confirm = useConfirm();

  // Filtros e paginação
  const [search, setSearch] = useState("");
  const [filterKind, setFilterKind] = useState<"all" | "income" | "expense" | "transfer">("all");
  const [filterCategoryId, setFilterCategoryId] = useState<string>("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filteredCats = categories.filter((c) => c.kind === kind && !c.is_archived);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialRules.filter((r) => {
      if (filterKind !== "all" && r.kind !== filterKind) return false;
      if (filterCategoryId !== "all" && r.category_id !== filterCategoryId) return false;
      if (q && !r.pattern.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [initialRules, search, filterKind, filterCategoryId]);

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRules = filteredRules.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const filterCategories = useMemo(() => {
    if (filterKind === "all") return categories.filter((c) => !c.is_archived);
    return categories.filter((c) => c.kind === filterKind && !c.is_archived);
  }, [categories, filterKind]);

  const hasActiveFilters = search !== "" || filterKind !== "all" || filterCategoryId !== "all";

  const resetFilters = () => {
    setSearch("");
    setFilterKind("all");
    setFilterCategoryId("all");
    setPage(1);
  };

  const handleCreate = () => {
    if (pattern.length < 2) return toast.error("Padrão muito curto.");
    if (!categoryId) return toast.error("Escolha uma categoria.");
    const fd = new FormData();
    fd.set("pattern", pattern);
    fd.set("categoryId", categoryId);
    fd.set("kind", kind);
    startTransition(async () => {
      const r = await createCategoryRule(undefined, fd);
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success("Regra criada.");
      setPattern("");
      setCategoryId("");
      setAdding(false);
    });
  };

  const handleDelete = async (rule: CategoryRule) => {
    const ok = await confirm({
      title: "Apagar essa regra?",
      description: `"${rule.pattern}" deixará de auto-categorizar novas transactions.`,
      confirmLabel: "Apagar",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteCategoryRule(rule.id);
      if (r.error) toast.error(r.error);
      else toast.success("Regra apagada.");
    });
  };

  const handleApply = () => {
    startApplying(async () => {
      const r = await applyRulesToUncategorized();
      if (r.error) {
        toast.error(r.error);
        return;
      }
      toast.success(
        r.matched === 0
          ? "Nenhuma transaction sem categoria bateu com as regras."
          : `${r.matched} transaction(s) categorizada(s).`,
      );
    });
  };

  return (
    <div className="space-y-3">
      {initialRules.length === 0 && !adding ? (
        <div className="text-center py-6 px-4">
          <p className="text-[13px] text-muted-foreground mb-3">
            Crie regras pra auto-categorizar transactions. Ex:{" "}
            <code className="font-mono">&quot;ifood&quot;</code> →{" "}
            <span className="font-medium">Restaurante</span>. Toda vez que cadastrar uma
            tx com &quot;ifood&quot; na descrição, a categoria já vem preenchida.
          </p>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
            Criar primeira regra
          </Button>
        </div>
      ) : null}

      {initialRules.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-faint-foreground"
                strokeWidth={1.7}
              />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Buscar padrão…"
                className="pl-8"
              />
            </div>
            <Select
              value={filterKind}
              onValueChange={(v) => {
                setFilterKind(v as typeof filterKind);
                setFilterCategoryId("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos tipos</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filterCategoryId}
              onValueChange={(v) => {
                setFilterCategoryId(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {filterCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11.5px] text-faint-foreground hover:text-foreground"
                aria-label="Limpar filtros"
              >
                <X className="w-3 h-3" strokeWidth={1.7} />
                Limpar
              </button>
            ) : null}
          </div>

          {filteredRules.length === 0 ? (
            <div className="text-center py-6 text-[12.5px] text-muted-foreground italic">
              Nenhuma regra bate com os filtros.
            </div>
          ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-faint-foreground font-mono text-[10px] uppercase tracking-[0.12em]">
                <th className="text-left pb-2 font-medium">Padrão (contém)</th>
                <th className="text-left pb-2 font-medium">Tipo</th>
                <th className="text-left pb-2 font-medium">Categoria</th>
                <th className="text-right pb-2 font-medium w-[80px]">Aplicações</th>
                <th className="w-[40px]" />
              </tr>
            </thead>
            <tbody>
              {pagedRules.map((r) => (
                <tr key={r.id} className="border-t border-border-strong/40">
                  <td className="py-2.5 font-mono text-[12px]">{r.pattern}</td>
                  <td className="py-2.5 text-muted-foreground">
                    {r.kind === "income"
                      ? "Receita"
                      : r.kind === "expense"
                        ? "Despesa"
                        : "Transfer"}
                  </td>
                  <td className="py-2.5">
                    {r.category ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ background: r.category.color ?? "#999" }}
                        />
                        {r.category.name}
                      </span>
                    ) : (
                      <span className="text-faint-foreground italic">categoria removida</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono tabular-nums text-faint-foreground">
                    {r.hits}
                  </td>
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(r)}
                      className="p-1.5 rounded text-faint-foreground hover:text-rust-600 hover:bg-rust-100/50 dark:hover:bg-rust-700/30"
                      aria-label="Apagar"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.7} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}

          {filteredRules.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between pt-1 text-[11.5px]">
              <span className="text-faint-foreground font-mono tabular-nums">
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, filteredRules.length)} de{" "}
                {filteredRules.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded text-faint-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
                <span className="font-mono tabular-nums px-2 text-muted-foreground">
                  {currentPage}/{totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded text-faint-foreground hover:text-foreground hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
                  aria-label="Próxima página"
                >
                  <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.7} />
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex justify-between gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleApply}
              disabled={applying}
            >
              <Sparkles className="w-3.5 h-3.5" strokeWidth={1.7} />
              {applying ? "Aplicando…" : "Aplicar nas tx sem categoria"}
            </Button>
            {!adding ? (
              <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
                <Plus className="w-3.5 h-3.5" strokeWidth={1.7} />
                Nova regra
              </Button>
            ) : null}
          </div>
        </>
      ) : null}

      {adding ? (
        <div className="border border-border rounded-[8px] p-4 bg-surface space-y-3">
          <div className="grid grid-cols-[1fr_120px_1fr] gap-2">
            <Input
              autoFocus
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="Padrão (ex: ifood, uber, posto)"
            />
            <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Despesa</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {filteredCats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="text-[11px] text-faint-foreground leading-relaxed">
            Match substring case-insensitive. Ex: padrão{" "}
            <code className="font-mono">posto</code> bate em &quot;Posto Shell&quot;, &quot;ipiranga
            posto&quot;, etc.
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleCreate}
              disabled={pending}
            >
              {pending ? "Criando…" : "Criar regra"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
