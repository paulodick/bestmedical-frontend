import { useEffect, useState } from "react";
import { LayoutDashboard, PieChart } from "lucide-react";
import { Block } from "../components/ui";
import { formatBRL } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

interface Resumo {
  kpis: {
    receitaRecebida: number;
    receitaAberta: number;
    despesaTotal: number;
    despesaPaga: number;
    despesaPendente: number;
    resultado: number;
  };
  fluxo: { mes: string; entrada: number; saida: number; saldo: number }[];
  despesasPorCategoria: { categoria: string; valor: number }[];
}

// Paleta para as barras de categoria (harmônica com o tema).
const CORES = [
  "#20808D",
  "#A84B2F",
  "#1B474D",
  "#944454",
  "#FFC553",
  "#848456",
  "#6E522B",
  "#BCE2E7",
];

export function DashboardFinanceiroPessoal() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .resumoPessoal()
      .then((r) => setResumo(r))
      .catch(() => setResumo(null))
      .finally(() => setCarregando(false));
  }, []);

  const k = resumo?.kpis;
  const categorias = resumo?.despesasPorCategoria || [];
  const maxCat = Math.max(1, ...categorias.map((c) => c.valor));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          Dashboard Financeiro Pessoal
        </h1>
        <p className="text-sm text-text-muted">
          Visão consolidada de receitas, despesas e resultado pessoais.
        </p>
      </div>

      {carregando && !resumo ? (
        <p className="py-8 text-center text-text-muted">Carregando...</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              rotulo="Receita recebida"
              valor={k?.receitaRecebida ?? 0}
              cor="text-emerald-600 dark:text-emerald-400"
            />
            <KpiCard
              rotulo="A receber (em aberto)"
              valor={k?.receitaAberta ?? 0}
              cor="text-sky-600 dark:text-sky-400"
            />
            <KpiCard
              rotulo="Resultado"
              valor={k?.resultado ?? 0}
              cor={
                (k?.resultado ?? 0) >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }
              destaque
            />
            <KpiCard
              rotulo="Despesas totais"
              valor={k?.despesaTotal ?? 0}
              cor="text-text"
            />
            <KpiCard
              rotulo="Despesas pagas"
              valor={k?.despesaPaga ?? 0}
              cor="text-red-600 dark:text-red-400"
            />
            <KpiCard
              rotulo="Despesas a pagar"
              valor={k?.despesaPendente ?? 0}
              cor="text-amber-600 dark:text-amber-400"
            />
          </div>

          <Block title="Despesas por categoria" icon={<PieChart size={18} />}>
            {categorias.length === 0 ? (
              <p className="py-6 text-center text-text-muted">
                Nenhuma despesa pessoal cadastrada ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {categorias.map((c, i) => (
                  <div key={c.categoria}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="text-text">{c.categoria}</span>
                      <span className="tabular-nums text-text-muted">
                        {formatBRL(c.valor)}
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-sm bg-surface-offset">
                      <div
                        className="h-3 rounded-sm"
                        style={{
                          width: `${(c.valor / maxCat) * 100}%`,
                          backgroundColor: CORES[i % CORES.length],
                          minWidth: "4px",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Block>
        </>
      )}
    </div>
  );
}

function KpiCard({
  rotulo,
  valor,
  cor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  cor: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-surface p-4 ${
        destaque ? "border-primary" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-text-muted">
        {destaque && <LayoutDashboard size={14} />}
        {rotulo}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${cor}`}>
        {formatBRL(valor)}
      </div>
    </div>
  );
}
