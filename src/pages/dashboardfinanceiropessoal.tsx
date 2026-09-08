import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  PieChart,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Activity,
} from "lucide-react";
import { Block } from "../components/ui";
import { formatBRL, formatDataBR } from "../lib/format";
import { api, API_ENABLED, type ResumoFinanceiro } from "../lib/api";

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

const MESES_ABREV: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};
function rotuloMes(mes: string): string {
  const [, m] = mes.split("-");
  return MESES_ABREV[m] || mes;
}

export function DashboardFinanceiroPessoal() {
  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
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
  const saldoAcumulado = resumo?.saldoAcumulado || [];
  const saldoAtual = saldoAcumulado.length
    ? saldoAcumulado[saldoAcumulado.length - 1].saldo
    : 0;
  const maxSaldo = Math.max(1, ...saldoAcumulado.map((s) => Math.abs(s.saldo)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">
          Dashboard Financeiro Pessoal
        </h1>
        <p className="text-sm text-text-muted">
          Visão consolidada de caixa, receitas e despesas pessoais.
        </p>
      </div>

      {carregando && !resumo ? (
        <p className="py-8 text-center text-text-muted">Carregando...</p>
      ) : (
        <>
          <div className="rounded-lg border border-border bg-surface p-5">
            <div className="text-xs uppercase tracking-wide text-text-muted">
              Saldo acumulado (entradas − saídas, últimos 12 meses)
            </div>
            <div
              className={`mt-1 text-3xl font-bold tabular-nums ${
                saldoAtual >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatBRL(saldoAtual)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
              rotulo="Receita recebida"
              valor={k?.receitaRecebida ?? 0}
              cor="text-emerald-600 dark:text-emerald-400"
            />
            <KpiCard
              rotulo="Despesas pagas"
              valor={k?.despesaPaga ?? 0}
              cor="text-red-600 dark:text-red-400"
            />
          </div>

          <Block title="Entradas e saídas por mês" icon={<TrendingUp size={18} />}>
            {saldoAcumulado.length === 0 ? (
              <p className="py-6 text-center text-text-muted">
                Ainda sem lançamentos suficientes para o gráfico.
              </p>
            ) : (
              <div className="flex items-end gap-1.5 overflow-x-auto pb-1" style={{ height: 140 }}>
                {saldoAcumulado.map((s) => {
                  const alturaPct = Math.max(4, (Math.abs(s.saldo) / maxSaldo) * 100);
                  return (
                    <div
                      key={s.mes}
                      className="flex min-w-[34px] flex-1 flex-col items-center justify-end gap-1"
                      title={`${rotuloMes(s.mes)}: ${formatBRL(s.saldo)}`}
                    >
                      <div
                        className={`w-full rounded-t-sm ${
                          s.saldo >= 0 ? "bg-emerald-500/80" : "bg-red-500/80"
                        }`}
                        style={{ height: `${alturaPct}%` }}
                      />
                      <span className="text-[10px] text-text-faint">{rotuloMes(s.mes)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Block>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Block title="Contas a Pagar" icon={<ArrowDownCircle size={18} />}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniKpi rotulo="Total" valor={resumo?.contasAPagar.total ?? 0} />
                <MiniKpi
                  rotulo="A pagar"
                  valor={resumo?.contasAPagar.aPagar ?? 0}
                  cor="text-amber-600 dark:text-amber-400"
                />
                <MiniKpi
                  rotulo="Atrasado"
                  valor={resumo?.contasAPagar.atrasado ?? 0}
                  cor="text-red-600 dark:text-red-400"
                />
              </div>
            </Block>

            <Block title="Contas a Receber" icon={<ArrowUpCircle size={18} />}>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniKpi rotulo="Total" valor={resumo?.contasAReceber.total ?? 0} />
                <MiniKpi
                  rotulo="A receber"
                  valor={resumo?.contasAReceber.aReceber ?? 0}
                  cor="text-sky-600 dark:text-sky-400"
                />
                <MiniKpi
                  rotulo="Atrasado"
                  valor={resumo?.contasAReceber.atrasado ?? 0}
                  cor="text-red-600 dark:text-red-400"
                />
              </div>
            </Block>
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

          {(resumo?.atividadeRecente?.length ?? 0) > 0 && (
            <Block title="Atividade recente" icon={<Activity size={18} />}>
              <ul className="divide-y divide-border">
                {resumo!.atividadeRecente.map((a, i) => (
                  <li key={i} className="flex items-center gap-3 py-2 text-sm">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        a.tipo === "entrada" ? "bg-emerald-500" : "bg-red-500"
                      }`}
                    />
                    <span className="flex-1 truncate text-text">{a.nome}</span>
                    <span className="text-xs text-text-faint">{formatDataBR(a.data)}</span>
                    <span
                      className={`w-24 shrink-0 text-right tabular-nums ${
                        a.tipo === "entrada"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {a.tipo === "saida" ? "− " : "+ "}
                      {formatBRL(a.valor)}
                    </span>
                  </li>
                ))}
              </ul>
            </Block>
          )}
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

function MiniKpi({
  rotulo,
  valor,
  cor = "text-text",
}: {
  rotulo: string;
  valor: number;
  cor?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-text-faint">{rotulo}</div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${cor}`}>
        {formatBRL(valor)}
      </div>
    </div>
  );
}
