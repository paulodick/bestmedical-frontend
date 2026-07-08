import React, { useState } from 'react';

export const Sidebar: React.FC = () => {
  const [isCrmOpen, setIsCrmOpen] = useState(false);
  const [isFinanceiroOpen, setIsFinanceiroOpen] = useState(false);
  const [isPessoalOpen, setIsPessoalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('Novo Orçamento');

  return (
    <aside className="w-72 bg-[#0B0F19] border-r border-[#1B2234] flex flex-col justify-between shrink-0 h-screen font-sans text-slate-100">
      {/* Topo: Logo e Nome */}
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-teal-500/10 border border-teal-500/20">
            <svg className="w-8 h-8 text-[#10E5CA]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              <circle cx="12" cy="12" r="9" className="opacity-20" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide text-white">Best Medical</h1>
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
              ? 'bg-[#10E5CA] text-slate-950 shadow-lg'
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
              : 'text-slate-400 hover:bg-slate-800/40'
          }`}
        >
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Proposta de Contrato</span>
          </div>
        </button>

        {/* CONTROLE FINANCEIRO */}
        <div className="border-t border-[#1B2234] pt-2">
          <button
            onClick={() => setIsFinanceiroOpen(!isFinanceiroOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs ${
              isFinanceiroOpen
                ? 'bg-slate-800/50 text-[#10E5CA]'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
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
            <div className="pl-12 pr-4 py-1.5 space-y-1 border-l border-teal-500/10 ml-6 mt-1">
              <button onClick={() => setActiveItem('Fluxo de Caixa')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Fluxo de Caixa</button>
              <button onClick={() => setActiveItem('Contas a Pagar')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Contas a Pagar</button>
            </div>
          )}
        </div>

        {/* CONTROLE PESSOAL */}
        <div className="pt-1">
          <button
            onClick={() => setIsPessoalOpen(!isPessoalOpen)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all font-medium text-xs ${
              isPessoalOpen
                ? 'bg-slate-800/50 text-[#10E5CA]'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
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
            <div className="pl-12 pr-4 py-1.5 space-y-1 border-l border-teal-500/10 ml-6 mt-1">
              <button onClick={() => setActiveItem('Despesas Pessoais')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Despesas Pessoais</button>
            </div>
          )}
        </div>

        {/* CRM EXPANSÍVEL */}
        <div className="border-t border-[#1B2234] pt-2">
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
            <svg className={`w-4 h-4 transition-transform duration-200 ${isCrmOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {isCrmOpen && (
            <div className="pl-12 pr-4 py-1.5 space-y-1 border-l border-teal-500/10 ml-6 mt-1">
              <button onClick={() => setActiveItem('CRM - Leads')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Contatos e Leads</button>
              <button onClick={() => setActiveItem('CRM - Kanban')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Kanban de Vendas</button>
              <button onClick={() => setActiveItem('CRM - Flows')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Automações IA (Flows)</button>
              <button onClick={() => setActiveItem('CRM - RAG')} className="block w-full text-left py-2 text-[11px] text-slate-400 hover:text-[#10E5CA]">Manuais e RAG</button>
            </div>
          )}
        </div>

      </div>

      {/* Rodapé paulodick */}
      <div className="p-4 border-t border-[#1B2234] bg-[#0E131F]/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-300">paulodick</span>
          <span className="text-[9px] font-bold bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full">Admin</span>
        </div>
      </div>
    </aside>
  );
};
