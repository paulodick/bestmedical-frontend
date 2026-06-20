import { useEffect, useState } from "react";
import { FilePlus2, LayoutList, Moon, Sun, LogOut } from "lucide-react";
import { StoreProvider } from "./store";
import { NovoOrcamento } from "./pages/NovoOrcamento";
import { Controle } from "./pages/Controle";
import { Login } from "./pages/Login";
import { AuthProvider, useAuth } from "./auth";
import { API_ENABLED } from "./lib/api";
import logoSymbol from "./assets/logo-symbol.png";
import type { Orcamento } from "./types";

type Page = "novo" | "controle";

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
      className={`flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-primary text-white shadow-sm"
          : "text-text-muted hover:bg-surface-offset hover:text-text"
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{children}</span>
    </button>
  );
}

function AppShell() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [page, setPage] = useState<Page>("controle");
  const [orcamentoEdit, setOrcamentoEdit] = useState<Orcamento | null>(null);
  const { logout } = useAuth();

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  return (
    <StoreProvider>
      <div className="min-h-screen bg-surface text-text font-sans selection:bg-primary/20">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md print:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Logo />
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavButton
                active={page === "novo"}
                onClick={() => {
                  setOrcamentoEdit(null); // Garante que a tela venha limpa ao clicar em "Novo Orçamento" no menu
                  setPage("novo");
                }}
                icon={<FilePlus2 size={17} />}
              >
                Novo Orçamento
              </NavButton>
              <NavButton
                active={page === "controle"}
                onClick={() => setPage("controle")}
                icon={<LayoutList size={17} />}
              >
                Controle
              </NavButton>
              <button
                onClick={toggleTheme}
                title="Alternar tema"
                className="ml-1 rounded-md p-2 text-text-muted transition hover:bg-surface-offset hover:text-text"
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
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 print:px-0 print:py-0">
          {page === "novo" ? (
            <NovoOrcamento orcamentoParaEditar={orcamentoEdit} />
          ) : (
            <Controle 
              onEdit={(orc) => {
                setOrcamentoEdit(orc);
                setPage("novo");
              }} 
            />
          )}
        </main>

        <footer className="border-t border-border py-5 text-center text-[12px] text-text-faint print:hidden">
          Best Medical • Sistema interno de orçamentos
        </footer>
      </div>
    </StoreProvider>
  );
}

// Decide entre tela de login e aplicação
function Gate() {
  const { autenticado } = useAuth();
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