import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Orcamento } from "./types";
import { SEED_ORCAMENTOS, type OrcamentoSeed } from "./lib/mock";
import { gerarParcelas, totalFinal } from "./lib/calc";
import { uid } from "./lib/format";
import { api, API_ENABLED } from "./lib/api";
import { useAuth } from "./auth";

// Garante que todo orçamento tenha os campos de parcelamento preenchidos
// (compatibilidade com seeds antigos sem numParcelas/parcelas).
function normalizar(o: OrcamentoSeed | Orcamento): Orcamento {
  const num = (o as Orcamento).numParcelas || 1;
  const existentes = (o as Orcamento).parcelas;
  const parcelas =
    existentes && existentes.length
      ? existentes
      : gerarParcelas(num, totalFinal(o), [
          { id: uid(), numero: 1, data: o.data, valor: 0 },
        ]);
  return { ...(o as Orcamento), numParcelas: num, parcelas };
}

// A interface pública do store é a MESMA — os componentes não mudam.
interface Store {
  orcamentos: Orcamento[];
  salvar: (o: Orcamento) => void;
  atualizar: (id: string, patch: Partial<Orcamento>) => void;
  remover: (id: string) => void;
  carregando: boolean;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(() =>
    API_ENABLED ? [] : SEED_ORCAMENTOS.map(normalizar),
  );
  const [carregando, setCarregando] = useState(false);

  // Carrega da API quando autenticado (modo real)
  const recarregar = async () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    try {
      const r = await api.listarOrcamentos("?order=data_desc&pageSize=100");
      setOrcamentos(r.data as Orcamento[]);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Falha ao carregar orçamentos:", e);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (API_ENABLED && autenticado) {
      recarregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  const store = useMemo<Store>(
    () => ({
      orcamentos,
      carregando,

      salvar: (o) => {
        if (!API_ENABLED) {
          // ===== modo mock (preserva a demo) =====
          setOrcamentos((prev) => {
            const idx = prev.findIndex((p) => p.id === o.id);
            if (idx >= 0) {
              const copy = [...prev];
              copy[idx] = o;
              return copy;
            }
            return [o, ...prev];
          });
          return;
        }
        // ===== modo real =====
        const existe = orcamentos.some((p) => p.id === o.id);
        const acao = existe
          ? api.atualizarOrcamento(o.id, o)
          : api.criarOrcamento(o);
        acao
          .then(() => recarregar())
          .catch((e) => console.error("Falha ao salvar:", e));
      },

      atualizar: (id, patch) => {
        if (!API_ENABLED) {
          setOrcamentos((prev) =>
            prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
          );
          return;
        }
        // Atualização otimista local + PATCH de status no servidor
        setOrcamentos((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        );
        api
          .atualizarStatus(id, patch)
          .catch((e) => console.error("Falha ao atualizar status:", e));
      },

      remover: (id) => {
        if (!API_ENABLED) {
          setOrcamentos((prev) => prev.filter((p) => p.id !== id));
          return;
        }
        setOrcamentos((prev) => prev.filter((p) => p.id !== id));
        api
          .removerOrcamento(id)
          .catch((e) => console.error("Falha ao remover:", e));
      },
    }),
    [orcamentos, carregando],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore deve estar dentro de StoreProvider");
  return ctx;
}
