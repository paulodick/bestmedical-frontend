import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReactFlowBuilder } from './pages/ReactFlowBuilder';

export function App() {
  // 1. O estado de navegação agora vive no pai (App)
  const [activeItem, setActiveItem] = useState('Novo Orçamento');

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F19]">
      {/* 2. Passamos o estado e o modificador como Props para a Sidebar */}
      <Sidebar activeItem={activeItem} setActiveItem={setActiveItem} />

      {/* 3. Área de Renderização Dinâmica das Telas do Painel */}
      <main className="flex-grow overflow-auto p-8 text-slate-100">
        
        {/* TELA A: NOVO ORÇAMENTO */}
        {activeItem === 'Novo Orçamento' && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold text-white">Novo Orçamento</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Crie e gerencie as propostas comerciais e orçamentos clínicos para os seus pacientes.
            </p>
            {/* Seu formulário antigo de geração de orçamentos encaixa-se perfeitamente aqui */}
          </div>
        )}

        {/* TELA B: KANBAN DE LEADS */}
        {activeItem === 'CRM - Kanban de Vendas' && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold text-white">CRM // Kanban de Vendas</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Monitore o funil de conversão de pacientes capturados e qualificados pela Inteligência Artificial.
            </p>
          </div>
        )}

        {/* TELA C: CONSTRUTOR DE FLUXOS DE IA */}
        {activeItem === 'CRM - Fluxos de IA' && (
          <div className="h-full w-full animate-fadeIn -m-8 p-8 bg-[#0b0f19]">
            <ReactFlowBuilder />
          </div>
        )}

        {/* TELA D: BASES DE CONHECIMENTO RAG */}
        {activeItem === 'CRM - Manuais de Suporte' && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold text-white">Manuais e Regulamentos (RAG)</h1>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Alimente a inteligência artificial com PDFs de convênios, tabelas de preços e diretrizes clínicas.
            </p>
          </div>
        )}

        {/* OUTROS MENUS (CONTROLE / FINANCEIRO) */}
        {activeItem === 'Controle' && (
          <div className="animate-fadeIn">
            <h1 className="text-2xl font-bold text-white">Painel de Controle</h1>
            <p className="text-xs text-slate-400 mt-2">Visão consolidada de fluxos e logs.</p>
          </div>
        )}

      </main>
    </div>
  );
}

export default App;
