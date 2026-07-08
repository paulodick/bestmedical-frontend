import React from 'react';
import { Sidebar } from './components/Sidebar';

// 1. Export Nomeado (para caso o main.tsx use chaves)
export function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19]">
      {/* Menu Lateral importado do Canvas */}
      <Sidebar />

      {/* Conteúdo Principal do Painel */}
      <main className="flex-grow overflow-auto p-8 text-slate-100">
        <h1 className="text-2xl font-bold text-white">Best Medical Platform</h1>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          Selecione uma das opções na barra lateral para começar a gerenciar os seus orçamentos e fluxos de automação de Inteligência Artificial.
        </p>
      </main>
    </div>
  );
}

// 2. Export Padrão/Default (para resolver o erro TS1192 no main.tsx)
export default App;
