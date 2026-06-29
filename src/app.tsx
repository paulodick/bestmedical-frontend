import { useEffect, useState } from "react";
import { FilePlus2, LayoutList, Moon, Sun, LogOut, Loader2, Users, FileText } from "lucide-react";
import { StoreProvider } from "./store";
import { NovoOrcamento } from "./pages/novoorcamento";
import { Controle } from "./pages/controle";
import { Crm } from "./pages/crm";
import { OrdemServicoPage } from "./pages/ordemservico";
import { PropostaContrato } from "./pages/propostacontrato";
import { Login } from "./pages/Login";
import { AuthProvider, useAuth } from "./auth";
import { API_ENABLED } from "./lib/api";
import logoSymbol from "./assets/logo-symbol.png";
import type { Orcamento, Proposta } from "./types";

type Page = "novo" | "controle" | "crm" | "os" | "proposta";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <img
        src={logoSymbol}
        alt="Best Medical"
        className="h-10 w-auto shrink-0 object-contain"
      />
      <div className="leading-tight">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold text-text">Best Medical</span>
          <span className="hidden text-[10px] font-medium italic text-text-faint sm:inline">
            When uptime matters.
          </span>
        </div>
        <div className="text-[11px] text-text-faint">Sistema de Orçamentos</div>
      </div>
    </div>
  );
}

// Item do menu lateral (sidebar à esquerda no desktop).
function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
        active
          ? "bg-primary text-white shadow-sm"
          : "text-slate-300 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span>{children}</span>
    </button>
  );
}

function AppShell() {
  // Lê a preferência de tema salva (persiste entre recarregamentos).
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try {
      const salvo = localStorage.getItem("bestmedical_theme");
      if (salvo === "dark" || salvo === "light") return salvo;
    } catch {
      /* localStorage indisponível */
    }
    return "light";
  });
  const [page, setPage] = useState<Page>("controle");
  const [orcamentoEdit, setOrcamentoEdit] = useState<Orcamento | null>(null);
  const [propostaEdit, setPropostaEdit] = useState<Proposta | null>(null);
  // Id do orçamento cuja OS deve ser aberta
  const [osOrcamentoId, setOsOrcamentoId] = useState<string | null>(null);
  const { logout, user } = useAuth();

  // CRM é exclusivo do login paulo@bestmedical.com.br.
  const podeVerCrm =
    (user?.email || "").trim().toLowerCase() === "paulo@bestmedical.com.br";

  // Se o usuário atual não pode ver o CRM mas está nessa página, volta ao Controle.
  useEffect(() => {
    if (page === "crm" && !podeVerCrm) setPage("controle");
  }, [page, podeVerCrm]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
    }
    try {
      localStorage.setItem("bestmedical_theme", theme);
    } catch {
      /* localStorage indisponível */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <StoreProvider>
      <div className="min-h-screen bg-surface text-text font-sans selection:bg-primary/20 lg:flex">
        {/* Menu lateral à esquerda (desktop) */}
        <aside className="sticky top-0 z-30 hidden h-screen w-64 shrink-0 flex-col bg-slate-900 print:hidden lg:flex">
          <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
            <img
              src={logoSymbol}
              alt="Best Medical"
              className="h-9 w-auto shrink-0 object-contain"
            />
            <div className="leading-tight">
              <div className="text-[14px] font-bold text-white">Best Medical</div>
              <div className="text-[10px] text-slate-400">Sistema de Orçamentos</div>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
            <NavButton
              active={page === "novo"}
              onClick={() => {
                setOrcamentoEdit(null); // Tela limpa ao clicar em "Novo Orçamento"
                setPage("novo");
              }}
              icon={<FilePlus2 size={18} />}
            >
              Novo Orçamento
            </NavButton>
            <NavButton
              active={page === "proposta"}
              onClick={() => {
                setPropostaEdit(null); // Tela limpa ao clicar em "Proposta de Contrato"
                setPage("proposta");
              }}
              icon={<FileText size={18} />}
            >
              Proposta de Contrato
            </NavButton>
            <NavButton
              active={page === "controle"}
              onClick={() => setPage("controle")}
              icon={<LayoutList size={18} />}
            >
              Controle
            </NavButton>
            {podeVerCrm && (
              <NavButton
                active={page === "crm"}
                onClick={() => setPage("crm")}
                icon={<Users size={18} />}
              >
                CRM
              </NavButton>
            )}
          </nav>

          <div className="border-t border-white/10 px-3 py-3">
            {user?.email && (
              <div className="mb-2 truncate px-2 text-[11px] text-slate-400">
                {user.email}
              </div>
            )}
            <div className="flex items-center gap-1">
              <button
                onClick={toggleTheme}
                title="Alternar tema"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
                <span>Tema</span>
              </button>
              {API_ENABLED && (
                <button
                  onClick={logout}
                  title="Sair"
                  className="ml-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut size={18} />
                  <span>Sair</span>
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Menu no topo (mobile) */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md print:hidden lg:hidden">
          <div className="flex items-center justify-between gap-2 px-4 py-3">
            <Logo />
            <nav className="flex items-center gap-1">
              <button
                onClick={() => {
                  setOrcamentoEdit(null);
                  setPage("novo");
                }}
                title="Novo Orçamento"
                className={`rounded-md p-2 ${page === "novo" ? "bg-primary text-white" : "text-text-muted"}`}
              >
                <FilePlus2 size={18} />
              </button>
              <button
                onClick={() => {
                  setPropostaEdit(null);
                  setPage("proposta");
                }}
                title="Proposta de Contrato"
                className={`rounded-md p-2 ${page === "proposta" ? "bg-primary text-white" : "text-text-muted"}`}
              >
                <FileText size={18} />
              </button>
              <button
                onClick={() => setPage("controle")}
                title="Controle"
                className={`rounded-md p-2 ${page === "controle" ? "bg-primary text-white" : "text-text-muted"}`}
              >
                <LayoutList size={18} />
              </button>
              {podeVerCrm && (
                <button
                  onClick={() => setPage("crm")}
                  title="CRM"
                  className={`rounded-md p-2 ${page === "crm" ? "bg-primary text-white" : "text-text-muted"}`}
                >
                  <Users size={18} />
                </button>
              )}
              <button
                onClick={toggleTheme}
                title="Alternar tema"
                className="rounded-md p-2 text-text-muted transition hover:bg-surface-offset hover:text-text"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {API_ENABLED && (
                <button
                  onClick={logout}
                  title="Sair"
                  className="rounded-md p-2 text-text-muted transition hover:bg-surface-offset hover:text-text"
                >
                  <LogOut size={18} />
                </button>
              )}
            </nav>
          </div>
        </header>

        {/* Conteúdo */}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 print:px-0 print:py-0">
            {page === "novo" ? (
              <NovoOrcamento orcamentoParaEditar={orcamentoEdit} />
            ) : page === "proposta" ? (
              <PropostaContrato propostaParaEditar={propostaEdit} />
            ) : page === "os" && osOrcamentoId ? (
              <OrdemServicoPage
                orcamentoId={osOrcamentoId}
                onVoltar={() => {
                  setOsOrcamentoId(null);
                  setPage("controle");
                }}
              />
            ) : page === "crm" && podeVerCrm ? (
              <Crm />
            ) : (
              <Controle
                onEdit={(orc) => {
                  setOrcamentoEdit(orc);
                  setPage("novo");
                }}
                onEditProposta={(prop) => {
                  setPropostaEdit(prop);
                  setPage("proposta");
                }}
                onAbrirOs={(orcId) => {
                  setOsOrcamentoId(orcId);
                  setPage("os");
                }}
              />
            )}
          </main>

          <footer className="border-t border-border py-5 text-center text-[12px] text-text-faint print:hidden">
            Best Medical • Sistema interno de orçamentos
          </footer>
        </div>
      </div>
    </StoreProvider>
  );
}

// Decide entre tela de login e aplicação
function Gate() {
  const { autenticado, carregando } = useAuth();
  // Enquanto reidrata a sessão (valida token salvo), evita piscar o login.
  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface text-text-muted">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }
  if (!autenticado) return <Login />;
  return <AppShell />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}
