import { useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Block } from "../components/ui";
import { formatBRL } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

interface LinhaFluxo {
  mes: string;
  entrada: number;
  saida: number;
  saldo: number;
}

// Converte 'yyyy-mm' para rótulo curto (ex.: 'jul/26').
function rotuloMes(ym: string): string {
  const [y, m] = ym.split("-");
  const nomes = [
    "jan",
    "fev",
    "mar",
    "abr",
    "mai",
    "jun",
    "jul",
    "ago",
    "set",
    "out",
    "nov",
    "dez",
  ];
  const idx = Number(m) - 1;
  return `${nomes[idx] || m}/${(y || "").slice(2)}`;
}

export function FluxoCaixa() {
  const [linhas, setLinhas] = useState<LinhaFluxo[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .resumoFinanceiro()
      .then((r) => setLinhas(r.fluxo || []))
      .catch(() => setLinhas([]))
      .finally(() => setCarregando(false));
  }, []);

  const totais = useMemo(() => {
    const entrada = linhas.reduce((s, l) => s + l.entrada, 0);
    const saida = linhas.reduce((s, l) => s + l.saida, 0);
    return { entrada, saida, saldo: entrada - saida };
  }, [linhas]);

  // Máximo (entradas ou saídas) para dimensionar as barras.
  const maxValor = useMemo(
    () =>
      Math.max(1, ...linhas.map((l) => Math.max(l.entrada, l.saida))),
    [linhas],
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">Fluxo de Caixa</h1>
        <p className="text-sm text-text-muted">
          Entradas (recebíveis pagos) e saídas (despesas pagas) dos últimos 12
          meses.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Entradas (12m)
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.entrada)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Saídas (12m)
          </div>
          <div className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">
            {formatBRL(totais.saida)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Saldo (12m)
          </div>
          <div
            className={`mt-1 text-xl font-semibold ${
              totais.saldo >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatBRL(totais.saldo)}
          </div>
        </div>
      </div>

      <Block title="Movimentação mensal" icon={<TrendingUp size={18} />}>
        {carregando ? (
          <p className="py-8 text-center text-text-muted">Carregando...</p>
        ) : (
          <>
            {/* Barras entrada x saída */}
            <div className="mb-6 space-y-3">
              {linhas.map((l) => (
                <div key={l.mes} className="flex items-center gap-3">
                  <div className="w-14 shrink-0 text-xs text-text-muted">
                    {rotuloMes(l.mes)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 rounded-sm bg-emerald-500"
                        style={{
                          width: `${(l.entrada / maxValor) * 100}%`,
                          minWidth: l.entrada > 0 ? "4px" : "0",
                        }}
                        title={`Entrada: ${formatBRL(l.entrada)}`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 rounded-sm bg-red-400"
                        style={{
                          width: `${(l.saida / maxValor) * 100}%`,
                          minWidth: l.saida > 0 ? "4px" : "0",
                        }}
                        title={`Saída: ${formatBRL(l.saida)}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mb-4 flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-emerald-500" />
                Entradas
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-3 w-3 rounded-sm bg-red-400" />
                Saídas
              </span>
            </div>

            {/* Tabela detalhada */}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                    <th className="px-2 py-2">Mês</th>
                    <th className="px-2 py-2 text-right">Entradas</th>
                    <th className="px-2 py-2 text-right">Saídas</th>
                    <th className="px-2 py-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.map((l) => (
                    <tr
                      key={l.mes}
                      className="border-b border-border/60 hover:bg-surface-offset/40"
                    >
                      <td className="px-2 py-2">{rotuloMes(l.mes)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatBRL(l.entrada)}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {formatBRL(l.saida)}
                      </td>
                      <td
                        className={`px-2 py-2 text-right font-medium tabular-nums ${
                          l.saldo >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {formatBRL(l.saldo)}
                      </td>
                    </tr>
                  ))}
                  {linhas.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-2 py-8 text-center text-text-muted"
                      >
                        Sem movimentação registrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Block>
    </div>
  );
}
