import { describe, it, expect } from "vitest";
import { parseCSV, statementTemplateCSV } from "./statement-csv";

describe("parseCSV", () => {
  it("lê cabeçalho + linhas com vírgula", () => {
    const recs = parseCSV("categoria,detalhe,valor\nMercado,Compras,450\nSaúde,Farmácia,90");
    expect(recs).toHaveLength(2);
    expect(recs[0]).toEqual({ categoria: "Mercado", detalhe: "Compras", valor: "450" });
    expect(recs[1].detalhe).toBe("Farmácia");
  });

  it("respeita aspas com vírgula/decimal dentro do campo", () => {
    const recs = parseCSV('categoria,detalhe,valor\nMercado,"Pão, leite e ovos","1.234,56"');
    expect(recs[0].detalhe).toBe("Pão, leite e ovos");
    expect(recs[0].valor).toBe("1.234,56");
  });

  it('desfaz aspas escapadas ("")', () => {
    const recs = parseCSV('categoria,detalhe,valor\nLazer,"Aspas "" aqui",10');
    expect(recs[0].detalhe).toBe('Aspas " aqui');
  });

  it("detecta ; como separador (Excel pt-BR) e ignora BOM", () => {
    const recs = parseCSV("﻿categoria;detalhe;valor\nMercado;Compras;450,00");
    expect(recs[0]).toEqual({ categoria: "Mercado", detalhe: "Compras", valor: "450,00" });
  });

  it("ignora linhas em branco e normaliza cabeçalho pra minúsculo", () => {
    const recs = parseCSV("Categoria,Detalhe,Valor\n\nMercado,Compras,450\n");
    expect(recs).toHaveLength(1);
    expect(recs[0].categoria).toBe("Mercado");
  });

  it("trata \\r\\n (Windows)", () => {
    const recs = parseCSV("categoria,valor\r\nMercado,450\r\nSaúde,90");
    expect(recs).toHaveLength(2);
    expect(recs[1].valor).toBe("90");
  });
});

describe("statementTemplateCSV", () => {
  it("gera modelo com BOM a partir de header + linhas, roundtrip pelo parser", () => {
    const csv = statementTemplateCSV(
      ["categoria", "detalhe", "valor", "moeda"],
      [["Mercado", "Compras", "450,00", "BRL"]],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const recs = parseCSV(csv);
    expect(recs).toHaveLength(1);
    expect(Object.keys(recs[0])).toEqual(["categoria", "detalhe", "valor", "moeda"]);
    expect(recs[0]).toEqual({ categoria: "Mercado", detalhe: "Compras", valor: "450,00", moeda: "BRL" });
  });

  it("suporta uma coluna 'pessoa' extra", () => {
    const recs = parseCSV(statementTemplateCSV(["categoria", "valor", "pessoa"], [["Mercado", "90", "Ana"]]));
    expect(recs[0].pessoa).toBe("Ana");
  });

  it("escapa valores com vírgula/decimal (roundtrip preserva)", () => {
    const recs = parseCSV(statementTemplateCSV(["detalhe", "valor"], [["Pão, leite", "1.234,56"]]));
    expect(recs[0].detalhe).toBe("Pão, leite");
    expect(recs[0].valor).toBe("1.234,56");
  });
});
