import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppShell } from "@/components/layout/app-shell";
import Painel from "@/pages/painel";
import Patrimonio from "@/pages/patrimonio";
import Investimentos from "@/pages/investimentos";
import Orcamento from "@/pages/orcamento";
import Historico from "@/pages/historico";
import Objetivos from "@/pages/objetivos";
import Projecao from "@/pages/projecao";
import Config from "@/pages/config";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Painel />} />
          <Route path="patrimonio" element={<Patrimonio />} />
          <Route path="investimentos" element={<Investimentos />} />
          <Route path="orcamento" element={<Orcamento />} />
          <Route path="historico" element={<Historico />} />
          <Route path="objetivos" element={<Objetivos />} />
          <Route path="projecao" element={<Projecao />} />
          <Route path="config" element={<Config />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
