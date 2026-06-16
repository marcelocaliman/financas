/**
 * Pilha de modais: garante que o Esc feche só a camada do TOPO (ex.: um Dialog de
 * confirmação aberto DENTRO do Drawer de Config — Esc fecha o Dialog, não o Drawer).
 */
const stack: symbol[] = [];

export function pushModal(): symbol {
  const id = Symbol("modal");
  stack.push(id);
  return id;
}

export function popModal(id: symbol): void {
  const i = stack.lastIndexOf(id);
  if (i >= 0) stack.splice(i, 1);
}

export function isTopModal(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
