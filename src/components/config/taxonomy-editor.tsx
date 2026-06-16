import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { actions } from "@/data/actions";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import type { Taxonomy, TaxonomyItem } from "@/domain/taxonomy";
import { Eyebrow } from "@/components/common/tile";
import { cn } from "@/lib/utils";

/**
 * Editor das listas que alimentam os dropdowns das tabelas (Classes, Subtipos em
 * cascata, Regiões, Indexadores, Tipos de passivo). Cada edição persiste a taxonomia
 * inteira na camada local-first (e sincroniza cifrada). Nada hardcoded nas tabelas.
 */
export function TaxonomyEditor() {
  const tax = useTaxonomy();
  const save = (next: Taxonomy) => void actions.putTaxonomy(next);

  return (
    <div className="grid lg:grid-cols-2 gap-x-12 gap-y-10 items-start">
      <ListEditor
        title="Classes"
        hint="Buckets de alocação dos ativos (a localização vai no campo Região)."
        items={tax.assetClasses}
        onChange={(items) => {
          // Remover uma classe poda os subtipos órfãos dela (cascata íntegra).
          const kept = new Set(items.map((c) => c.id));
          save({ ...tax, assetClasses: items, subtypes: tax.subtypes.filter((s) => kept.has(s.classId)) });
        }}
      />
      <SubtypeEditor tax={tax} save={save} />
      <ListEditor
        title="Regiões"
        items={tax.regions}
        onChange={(items) => save({ ...tax, regions: items })}
      />
      <ListEditor
        title="Indexadores"
        hint="Aparecem só em ativos de Renda Fixa."
        items={tax.indexers}
        onChange={(items) => save({ ...tax, indexers: items })}
      />
      <ListEditor
        title="Tipos de passivo"
        items={tax.liabilityTypes}
        onChange={(items) => save({ ...tax, liabilityTypes: items })}
      />
      <ListEditor
        title="Categorias de receita"
        hint="Aparecem no dropdown de Receitas do Orçamento."
        items={tax.incomeCategories}
        onChange={(items) => save({ ...tax, incomeCategories: items })}
      />
      <ListEditor
        title="Categorias de gasto"
        hint="Aparecem no dropdown de Gastos do Orçamento."
        items={tax.expenseCategories}
        onChange={(items) => save({ ...tax, expenseCategories: items })}
      />
    </div>
  );
}

function SubtypeEditor({ tax, save }: { tax: Taxonomy; save: (t: Taxonomy) => void }) {
  const [classId, setClassId] = useState(tax.assetClasses[0]?.id ?? "");
  const subs = tax.subtypes.filter((s) => s.classId === classId);
  const setSubs = (next: typeof subs) =>
    save({ ...tax, subtypes: [...tax.subtypes.filter((s) => s.classId !== classId), ...next] });

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <Eyebrow>Subtipos</Eyebrow>
        <span className="text-[11px] text-faint tabular">{subs.length}</span>
      </div>
      <select
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="w-full h-9 px-2.5 mb-2.5 rounded-[8px] border border-border bg-card text-[13.5px] outline-none focus:border-accent cursor-pointer"
      >
        {tax.assetClasses.map((c) => (
          <option key={c.id} value={c.id} className="bg-card text-text">
            {c.name}
          </option>
        ))}
      </select>
      <ListEditor
        items={subs}
        onChange={setSubs}
        makeItem={(name) => ({ id: crypto.randomUUID(), classId, name })}
      />
      <p className="text-[11.5px] text-faint mt-2 leading-relaxed">
        Em cascata da Classe — o dropdown de Subtipo mostra só os desta classe.
      </p>
    </section>
  );
}

function ListEditor<T extends TaxonomyItem>({
  title,
  hint,
  items,
  onChange,
  makeItem,
}: {
  title?: string;
  hint?: string;
  items: T[];
  onChange: (items: T[]) => void;
  makeItem?: (name: string) => T;
}) {
  const [adding, setAdding] = useState("");
  const rename = (id: string, name: string) =>
    onChange(items.map((i) => (i.id === id ? { ...i, name } : i)));
  const remove = (id: string) => onChange(items.filter((i) => i.id !== id));
  const add = () => {
    const name = adding.trim();
    if (!name) return;
    const item = makeItem ? makeItem(name) : ({ id: crypto.randomUUID(), name } as T);
    onChange([...items, item]);
    setAdding("");
  };

  return (
    <section>
      {title ? (
        <div className="flex items-center justify-between mb-3">
          <Eyebrow>{title}</Eyebrow>
          <span className="text-[11px] text-faint tabular">{items.length}</span>
        </div>
      ) : null}
      <div className="space-y-1.5">
        {items.map((it) => (
          <Row key={it.id} name={it.name} onRename={(n) => rename(it.id, n)} onRemove={() => remove(it.id)} />
        ))}
        {items.length === 0 ? <p className="text-[12px] text-faint py-1">Vazio.</p> : null}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Adicionar…"
          className="flex-1 h-9 px-2.5 rounded-[8px] border border-dashed border-border-strong bg-transparent text-[13.5px] outline-none focus:border-accent placeholder:text-faint"
        />
        <IconBtn onClick={add} kind="add" label="Adicionar">
          <Plus size={16} />
        </IconBtn>
      </div>
      {hint ? <p className="text-[11.5px] text-faint mt-2 leading-relaxed">{hint}</p> : null}
    </section>
  );
}

function Row({
  name,
  onRename,
  onRemove,
}: {
  name: string;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        key={name}
        defaultValue={name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== name) onRename(v);
          else e.target.value = name;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "Escape") {
            e.currentTarget.value = name;
            e.currentTarget.blur();
          }
        }}
        className="flex-1 h-9 px-2.5 rounded-[8px] border border-border bg-card text-[13.5px] outline-none focus:border-accent"
      />
      <IconBtn onClick={onRemove} kind="remove" label="Remover">
        <Trash2 size={15} />
      </IconBtn>
    </div>
  );
}

function IconBtn({
  onClick,
  kind,
  label,
  children,
}: {
  onClick: () => void;
  kind: "add" | "remove";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid place-items-center w-9 h-9 rounded-[8px] text-faint transition-colors shrink-0 hover:bg-card-hover",
        kind === "remove" ? "hover:text-neg" : "hover:text-accent",
      )}
    >
      {children}
    </button>
  );
}
