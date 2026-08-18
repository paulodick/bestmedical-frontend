import { useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { Block, Input, Select } from "../components/ui";
import { formatBRL, formatDataBR } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

interface Lancamento {
  id: string;
  data: string; // yyyy-mm-dd
  tipo: "entrada" | "saida";
  origem: string;
  descricao: string;
  categoria: string;
  valor: number;
}

type Granularidade = "dia" | "semana" | "mes" | "ano";
type CampoOrdenacao = "data" | "tipo" | "origem" | "categoria" | "valor";

// ===== Utilidades de data (yyyy-mm-dd, sem depender de fuso do navegador) =====
function hojeLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}

function paraDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function paraISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Início (segunda-feira) da semana que contém a data.
function inicioSemana(d: Date): Date {
  const dia = d.getDay(); // 0 = domingo
  const deslocamento = dia === 0 ? -6 : 1 - dia;
  const seg = new Date(d);
  seg.setDate(d.getDate() + deslocamento);
  return seg;
}

// Calcula o intervalo [inicio, fim] (yyyy-mm-dd, inclusivo) para a
// granularidade e data de referência selecionadas.
function calcularIntervalo(
  granularidade: Granularidade,
  referencia: string,
): { inicio: string; fim: string; label: string } {
  const ref = paraDate(referencia);
  if (granularidade === "dia") {
    return { inicio: referencia, fim: referencia, label: formatDataBR(referencia) };
  }
  if (granularidade === "semana") {
    const ini = inicioSemana(ref);
    const fim = new Date(ini);
    fim.setDate(ini.getDate() + 6);
    return {
      inicio: paraISO(ini),
      fim: paraISO(fim),
      label: `${formatDataBR(paraISO(ini))} a ${formatDataBR(paraISO(fim))}`,
    };
  }
  if (granularidade === "mes") {
    const ini = new Date(ref.getFullYear(), ref.getMonth(), 1);
    const fim = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    const nomes = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    return {
      inicio: paraISO(ini),
      fim: paraISO(fim),
      label: `${nomes[ref.getMonth()]}/${ref.getFullYear()}`,
    };
  }
  // ano
  const ini = new Date(ref.getFullYear(), 0, 1);
  const fim = new Date(ref.getFullYear(), 11, 31);
  return { inicio: paraISO(ini), fim: paraISO(fim), label: String(ref.getFullYear()) };
}

// Desloca a referência um passo (±1) na unidade da granularidade atual.
function deslocarReferencia(
  granularidade: Granularidade,
  referencia: string,
  passo: number,
): string {
  const d = paraDate(referencia);
  if (granularidade === "dia") d.setDate(d.getDate() + passo);
  else if (granularidade === "semana") d.setDate(d.getDate() + passo * 7);
  else if (granularidade === "mes") d.setMonth(d.getMonth() + passo);
  else d.setFullYear(d.getFullYear() + passo);
  return paraISO(d);
}

export function FluxoCaixa() {
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(false);

  const [granularidade, setGranularidade] = useState<Granularidade>("mes");
  const [referencia, setReferencia] = useState(hojeLocalISO());
  const [tipoFiltro, setTipoFiltro] = useState<"todos" | "entrada" | "saida">("todos");
  const [busca, setBusca] = useState("");

  const [sortCampo, setSortCampo] = useState<CampoOrdenacao>("data");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const ordenarPor = (campo: CampoOrdenacao) => {
    if (sortCampo === campo) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCampo(campo);
      setSortDir(campo === "valor" ? "desc" : "asc");
    }
  };

  const carregar = () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .listarFluxoCaixa()
      .then((r) => setLancamentos((r as Lancamento[]) || []))
      .catch(() => setLancamentos([]))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const intervalo = useMemo(
    () => calcularIntervalo(granularidade, referencia),
    [granularidade, referencia],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = lancamentos.filter((l) => {
      if (l.data < intervalo.inicio || l.data > intervalo.fim) return false;
      if (tipoFiltro !== "todos" && l.tipo !== tipoFiltro) return false;
      if (q) {
        return (
          l.origem.toLowerCase().includes(q) ||
          l.descricao.toLowerCase().includes(q) ||
          l.categoria.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const arr = [...base];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortCampo) {
        case "data":
          cmp = a.data.localeCompare(b.data);
          break;
        case "tipo":
          cmp = a.tipo.localeCompare(b.tipo);
          break;
        case "origem":
          cmp = a.origem.localeCompare(b.origem, "pt-BR", { sensitivity: "base" });
          break;
        case "categoria":
          cmp = a.categoria.localeCompare(b.categoria, "pt-BR", { sensitivity: "base" });
          break;
        case "valor":
          cmp = a.valor - b.valor;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [lancamentos, intervalo, tipoFiltro, busca, sortCampo, sortDir]);

  const totais = useMemo(() => {
    const entrada = filtrados
      .filter((l) => l.tipo === "entrada")
      .reduce((s, l) => s + l.valor, 0);
    const saida = filtrados
      .filter((l) => l.tipo === "saida")
      .reduce((s, l) => s + l.valor, 0);
    return { entrada, saida, saldo: entrada - saida };
  }, [filtrados]);

  const cabecalho = (campo: CampoOrdenacao, label: string, alinhamento = "text-left") => (
    <th className={`px-2 py-2 ${alinhamento}`}>
      <button
        type="button"
        onClick={() => ordenarPor(campo)}
        className={`inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-text-muted hover:text-text ${
          alinhamento === "text-right" ? "flex-row-reverse" : ""
        }`}
      >
        {label}
        {sortCampo === campo ? (
          sortDir === "asc" ? (
            <ChevronUp size={13} />
          ) : (
            <ChevronDown size={13} />
          )
        ) : (
          <ArrowUpDown size={13} className="opacity-40" />
        )}
      </button>
    </th>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-text">Fluxo de Caixa</h1>
        <p className="text-sm text-text-muted">
          Todas as entradas e saídas já realizadas, lançamento a lançamento —
          filtre por dia, semana, mês ou ano.
        </p>
      </div>

      {/* Cartões de totais do período selecionado */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Entradas
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.entrada)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Saídas
          </div>
          <div className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">
            {formatBRL(totais.saida)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Saldo
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

      <Block title="Lançamentos" icon={<TrendingUp size={18} />}>
        {/* Navegação de período */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border p-1">
            {(["dia", "semana", "mes", "ano"] as Granularidade[]).map((g) => (
              <button
                key={g}
                onClick={() => setGranularidade(g)}
                className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${
                  granularidade === g
                    ? "bg-primary text-white"
                    : "text-text-muted hover:bg-surface-offset"
                }`}
              >
                {g === "mes" ? "Mês" : g}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setReferencia((r) => deslocarReferencia(granularidade, r, -1))}
              title="Período anterior"
              className="rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="min-w-[140px] text-center text-sm font-medium text-text">
              {intervalo.label}
            </span>
            <button
              onClick={() => setReferencia((r) => deslocarReferencia(granularidade, r, 1))}
              title="Próximo período"
              className="rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={() => setReferencia(hojeLocalISO())}
              className="ml-1 rounded-md border border-border px-2 py-1 text-xs text-text-muted hover:bg-surface-offset hover:text-text"
            >
              Hoje
            </button>
          </div>

          <Select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as typeof tipoFiltro)}
            className="!w-auto"
          >
            <option value="todos">Todos</option>
            <option value="entrada">Só entradas</option>
            <option value="saida">Só saídas</option>
          </Select>

          <div className="max-w-xs flex-1">
            <Input
              placeholder="Buscar por origem, descrição, categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {cabecalho("data", "Data")}
                {cabecalho("tipo", "Tipo")}
                {cabecalho("origem", "Origem")}
                <th className="px-2 py-2 text-left text-xs font-medium uppercase tracking-wide text-text-muted">
                  Descrição
                </th>
                {cabecalho("categoria", "Categoria")}
                {cabecalho("valor", "Valor", "text-right")}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border/60 hover:bg-surface-offset/40"
                >
                  <td className="whitespace-nowrap px-2 py-2">
                    {formatDataBR(l.data)}
                  </td>
                  <td className="px-2 py-2">
                    {l.tipo === "entrada" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Entrada
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Saída
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-medium text-text">{l.origem}</td>
                  <td className="px-2 py-2 text-text-muted">{l.descricao}</td>
                  <td className="px-2 py-2">{l.categoria}</td>
                  <td
                    className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${
                      l.tipo === "entrada"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {l.tipo === "saida" ? "− " : ""}
                    {formatBRL(l.valor)}
                  </td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-2 py-8 text-center text-text-muted">
                    {carregando
                      ? "Carregando..."
                      : "Nenhum lançamento no período selecionado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>
    </div>
  );
}
