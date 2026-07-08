import { useState } from 'react';

// 1. Definição estrita das propriedades que a Sidebar aceita
interface SidebarProps {
  activeItem: string;
  setActiveItem: (item: string) => void;
}

export function Sidebar({ activeItem, setActiveItem }: SidebarProps) {
  // O estado activeItem agora é recebido como propriedade do elemento pai (App)
  const [isCrmOpen, setIsCrmOpen] = useState(false);
  const [isFinanceiroOpen, setIsFinanceiroOpen] = useState(false);
  const [isPessoalOpen, setIsPessoalOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // SVG do logotipo circular da Best Medical
  const MedicalLogo = () => (
    <svg className="w-8 h-8 text-[#10E5CA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      <circle cx="12" cy="12" r="9" className="opacity-20" fill="currentColor" />
    </svg>
  );

  return (
    <aside className={`w-72 flex flex-col justify-between border-r shrink-0 transition-colors duration-300 ${isDarkMode ? 'bg-[#0B0F19] border-[#1B2234] text-slate-100' : 'bg-white border-slate-200 text-slate-800'}`}>
      
      {/* Topo: Logo e Nome */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <MedicalLogo />
          </div>
          <div>
            <h1 className={`text-base font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Best Medical</h1>
            <p className="text-[10px] text-teal-400 font-bold tracking-wider uppercase">Sistema de Orçamentos</p>
          </div>
        </div>
      </div>

      {/* Links de Navegação */}
      <div className="flex-grow px-4 space-y-1.5 overflow-y-auto">
        
        {/* Item 1: Novo Orçamento */}
        <button
          onClick={() => setActiveItem('Novo Orçamento')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-semibold text-xs ${
            activeItem === 'Novo Orçamento'
              ? 'bg-[#10E5CA] text-slate-950 shadow-lg shadow-teal-500/10'
              : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Novo Orçamento</span>
          </div>
        </button>

        {/* Item 2: Proposta de Contrato */}
        <button
          onClick={() => setActiveItem('Proposta de Contrato')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs ${
            activeItem === 'Proposta de Contrato'
              ? 'bg-[#1D283D] text-[#10E5CA] border border-teal-500/20'
              : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Proposta de Contrato</span>
          </div>
        </button>

        {/* Item 3: Controle */}
        <button
          onClick={() => setActiveItem('Controle')}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs ${
            activeItem === 'Controle'
              ? 'bg-[#1D283D] text-[#10E5CA] border border-teal-500/20'
              : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
            </svg>
            <span>Controle</span>
          </div>
        </button>

        {/* Item 4: Controle Financeiro */}
        <div>
          <button
            onClick={() => setIsFinanceiroOpen(!isFinanceiroOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs text-slate-400 hover:bg-slate-800/40 hover:text-white"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Controle Financeiro</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-200 ${isFinanceiroOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isFinanceiroOpen && (
            <div className="pl-12 pr-4 py-1 space-y-1">
              <a href="#/fin/entradas" className="block py-2 text-[11px] text-slate-400 hover:text-white transition-colors">Fluxo de Caixa</a>
              <a href="#/fin/saidas" className="block py-2 text-[11px] text-slate-400 hover:text-white transition-colors">Contas a Pagar</a>
            </div>
          )}
        </div>

        {/* Item 5: Controle Financeiro Pessoal */}
        <div>
          <button
            onClick={() => setIsPessoalOpen(!isPessoalOpen)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs text-slate-400 hover:bg-slate-800/40 hover:text-white"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Controle Pessoal</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-200 ${isPessoalOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {isPessoalOpen && (
            <div className="pl-12 pr-4 py-1 space-y-1">
              <a href="#/pessoal/despesas" className="block py-2 text-[11px] text-slate-400 hover:text-white transition-colors">Despesas Pessoais</a>
            </div>
          )}
        </div>

        {/* Item 6: Dropdown CRM Expansível */}
        <div className="border-t border-[#1B2234] pt-2 mt-2">
          <button
            onClick={() => setIsCrmOpen(!isCrmOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs ${
              isCrmOpen || activeItem.startsWith('CRM')
                ? 'bg-slate-800/50 text-[#10E5CA]'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <span>CRM</span>
            </div>
            <svg className={`w-4 h-4 transition-transform duration-200 ${isCrmOpen ? 'transform rotate-180' : 'text-[#10E5CA]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isCrmOpen && (
            <div className="pl-12 pr-4 py-1.5 space-y-1 border-l border-teal-500/10 ml-6 mt-1">
              <button
                onClick={() => setActiveItem('CRM - Contatos e Leads')}
                className={`w-full text-left block py-2 text-[11px] rounded-lg px-2 transition-all ${
                  activeItem === 'CRM - Contatos e Leads'
                    ? 'bg-teal-500/10 text-[#10E5CA] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                Contatos e Leads
              </button>
              <button
                onClick={() => setActiveItem('CRM - Kanban de Vendas')}
                className={`w-full text-left block py-2 text-[11px] rounded-lg px-2 transition-all ${
                  activeItem === 'CRM - Kanban de Vendas'
                    ? 'bg-teal-500/10 text-[#10E5CA] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                Kanban de Vendas
              </button>
              <button
                onClick={() => setActiveItem('CRM - Fluxos de IA')}
                className={`w-full text-left block py-2 text-[11px] rounded-lg px-2 transition-all ${
                  activeItem === 'CRM - Fluxos de IA'
                    ? 'bg-teal-500/10 text-[#10E5CA] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                Fluxos de Automação IA
              </button>
              <button
                onClick={() => setActiveItem('CRM - Manuais de Suporte')}
                className={`w-full text-left block py-2 text-[11px] rounded-lg px-2 transition-all ${
                  activeItem === 'CRM - Manuais de Suporte'
                    ? 'bg-teal-500/10 text-[#10E5CA] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/30'
                }`}
              >
                Manuais e Convênios (RAG)
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Rodapé: Usuário e Botões */}
      <div className={`p-4 border-t ${isDarkMode ? 'border-[#1B2234] bg-[#0E131F]/40' : 'border-slate-200 bg-slate-100/50'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-[#10E5CA] animate-pulse"></div>
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>paulodick</span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-500/10 text-teal-400 px-2.5 py-0.5 rounded-full">
            Admin
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-[11px] font-medium transition-all ${
              isDarkMode 
                ? 'bg-slate-800/40 border-[#1B2234] text-slate-300 hover:bg-slate-800' 
                : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            🌙 {isDarkMode ? 'Claro' : 'Escuro'}
          </button>
          <button
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-[11px] font-medium transition-all ${
              isDarkMode 
                ? 'bg-red-500/5 border-red-500/10 text-red-400 hover:bg-red-500/10' 
                : 'bg-white border-red-200 text-red-500 hover:bg-red-50'
            }`}
          >
            Sair
          </button>
        </div>
      </div>

    </aside>
  );
}
