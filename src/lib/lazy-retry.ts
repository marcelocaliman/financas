/**
 * Auto-cura de chunk lazy: com o code-splitting, uma aba ABERTA na versão antiga pode pedir um
 * chunk que já não existe no servidor (todo deploy renomeia os arquivos) — o import() falha e a
 * seção quebrava até o usuário recarregar na mão. Aqui, na PRIMEIRA falha recarregamos a página
 * sozinhos (o reload traz a versão nova inteira); um guard em sessionStorage impede loop se a
 * falha for outra (rede fora, etc.) — aí o erro sobe e o SectionBoundary mostra o aviso honesto.
 */
const KEY = "nf-chunk-reload";

export function lazyRetry<T>(factory: () => Promise<T>): () => Promise<T> {
  return () =>
    factory().then(
      (mod) => {
        // Carregou: limpa o guard pra um PRÓXIMO deploy na mesma sessão também poder se curar.
        try {
          sessionStorage.removeItem(KEY);
        } catch {
          /* sem storage → segue */
        }
        return mod;
      },
      (err) => {
        try {
          if (!sessionStorage.getItem(KEY)) {
            sessionStorage.setItem(KEY, "1");
            window.location.reload();
            return new Promise<T>(() => {}); // nunca resolve — a página está recarregando
          }
        } catch {
          /* sem storage → sem retry automático */
        }
        throw err;
      },
    );
}
