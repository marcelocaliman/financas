import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Desabilita o client-side router cache: toda navegação re-fetcha o
    // RSC do server, garantindo que mudanças feitas em uma página
    // (ex: atualizar saldo em /investimentos) apareçam imediatamente
    // ao navegar pra outra (/dashboard, /ir, /patrimonio).
    //
    // Trade-off: navegação fica ~50ms mais lenta. Pra app pessoal de
    // finanças onde dados mudam o tempo todo, freshness > velocidade.
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
