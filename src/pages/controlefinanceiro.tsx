import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  ChevronDown,
  Calendar,
  ClipboardList,
} from "lucide-react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import type { Orcamento, Proposta } from "../types";
import { Modal } from "../components/Modal";
import { Button, Input, Select } from "../components/ui";
import { formatBRL, formatDataBR } from "../lib/format";
import { totalFinal } from "../lib/calc";
import { api, API_ENABLED } from "../lib/api";

// ===== Registro unificado (orçamento | proposta) =====
type TipoRegistro = "orcamento" | "proposta";
interface Registro {
  tipoRegistro: TipoRegistro;
  id: string;
  numero: string;
  data: string;
  empresa: string;
  cnpj: string;
  total: number;
  dataPagamento?: string | null;
  pago: boolean;
  atrasado: boolean;
  cancelado: boolean;
  orcamento?: Orcamento;
  proposta?: Proposta;
}

// Status financeiros disponíveis no filtro (checkboxes).
const STATUS_FIN: { key: "pago" | "atrasado" | "cancelado"; label: string }[] = [
  { key: "pago", label: "Pago" },
  { key: "atrasado", label: "Atrasado" },
  { key: "cancelado", label: "Cancelado" },
];

// Retorna a data de hoje (yyyy-mm-dd) no fuso local.
function hojeLocalISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60_000);
  return local.toISOString().slice(0, 10);
}

// Um recebimento está atrasado quando tem data de pagamento no passado
// (antes de hoje) e ainda não foi marcado como Pago (nem Cancelado).
function estaVencido(r: {
  dataPagamento?: string | null;
  pago: boolean;
  cancelado: boolean;
}): boolean {
  if (r.pago || r.cancelado) return false;
  if (!r.dataPagamento) return false;
  return r.dataPagamento < hojeLocalISO();
}

export function ControleFinanceiro() {
  const { orcamentos, atualizar } = useStore();
  const { user } = useAuth();

  // Só o admin master (paulodick) pode editar campos direto na tabela.
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [propostas, setPropostas] = useState<Proposta[]>([]);

  // Filtros
  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);
  const [statusAberto, setStatusAberto] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Edição inline da data de pagamento
  const [editId, setEditId] = useState<string | null>(null);
  const [rascunhoData, setRascunhoData] = useState("");

  // Modal de Resumo de recebimentos
  const [resumoAberto, setResumoAberto] = useState(false);

  // Carrega as propostas da API.
  const recarregarPropostas = () => {
    if (!API_ENABLED) return;
    api
      .listarPropostas("?order=data_desc&pageSize=100")
      .then((r) => setPropostas(r.data as Proposta[]))
      .catch((e) => console.error("Falha ao carregar propostas:", e));
  };

  useEffect(() => {
    recarregarPropostas();
  }, []);

  // Fecha o dropdown de status ao clicar fora.
  useEffect(() => {
    if (!statusAberto) return;
    const onClickFora = (e: MouseEvent) => {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusAberto(false);
      }
    };
    document.addEventListener("mousedown", onClickFora);
    return () => document.removeEventListener("mousedown", onClickFora);
  }, [statusAberto]);

  // ===== Persistência de status =====
  const salvarStatus = (
    r: Registro,
    patch: Record<string, boolean | string | null>,
  ) => {
    if (r.tipoRegistro === "orcamento") {
      atualizar(r.id, patch as Partial<Orcamento>);
      return;
    }
    setPropostas((prev) =>
      prev.map((p) => (p.id === r.id ? { ...p, ...patch } : p)),
    );
    if (API_ENABLED) {
      api
        .atualizarStatusProposta(r.id, patch)
        .then((p) =>
          setPropostas((prev) =>
            prev.map((x) => (x.id === r.id ? (p as Proposta) : x)),
          ),
        )
        .catch((e) => console.error("Falha ao atualizar proposta:", e));
    }
  };

  // Pago: alterna. Ao marcar Pago, limpa Atrasado (não faz sentido os dois).
  const togglePago = (r: Registro) => {
    const novo = !r.pago;
    salvarStatus(r, { pago: novo, ...(novo ? { atrasado: false } : {}) });
  };

  // Atrasado: alterna manualmente (o sistema também aciona automaticamente).
  const toggleAtrasado = (r: Registro) => {
    salvarStatus(r, { atrasado: !r.atrasado });
  };

  // Cancelado: oculta o registro nas tabelas Controle e Financeiro.
  // Ao cancelar, limpa os demais status; ao reativar, apenas remove cancelado.
  const toggleCancelado = (r: Registro) => {
    const novo = !r.cancelado;
    const patch: Record<string, boolean> = { cancelado: novo };
    if (novo) {
      patch.pago = false;
      patch.atrasado = false;
      patch.enviado = false;
      patch.aprovado = false;
      patch.realizado = false;
      patch.aguardandoPeca = false;
      patch.ordemServico = false;
      patch.pagamentoRealizado = false;
      patch.reprovado = false;
      patch.assinado = false;
      patch.vigente = false;
    }
    salvarStatus(r, patch);
  };

  // Salva a data de pagamento editada inline.
  const salvarDataPagamento = (r: Registro) => {
    salvarStatus(r, { dataPagamento: rascunhoData || null });
    setEditId(null);
  };

  // ===== Une orçamentos + propostas em registros =====
  const registros = useMemo<Registro[]>(() => {
    const dosOrc: Registro[] = orcamentos.map((o) => ({
      tipoRegistro: "orcamento",
      id: o.id,
      numero: o.numero,
      data: o.data,
      empresa: o.empresa,
      cnpj: o.cnpj,
      total: totalFinal(o),
      dataPagamento: o.dataPagamento ?? null,
      pago: !!o.pago,
      atrasado: !!o.atrasado,
      cancelado: !!o.cancelado,
      orcamento: o,
    }));
    const dasProp: Registro[] = propostas.map((p) => ({
      tipoRegistro: "proposta",
      id: p.id,
      numero: p.numero,
      data: p.data,
      empresa: p.empresa,
      cnpj: p.cnpj,
      total: p.total,
      dataPagamento: p.dataPagamento ?? null,
      pago: !!p.pago,
      atrasado: !!p.atrasado,
      cancelado: !!p.cancelado,
      proposta: p,
    }));
    return [...dosOrc, ...dasProp];
  }, [orcamentos, propostas]);

  // ===== Auto-atraso: marca Atrasado quando a data venceu e não foi pago =====
  // Roda quando os registros mudam. Persiste apenas o que precisa mudar.
  useEffect(() => {
    for (const r of registros) {
      if (r.cancelado) continue;
      if (estaVencido(r) && !r.atrasado) {
        salvarStatus(r, { atrasado: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros]);

  const empresas = useMemo(
    () => [...new Set(registros.map((r) => r.empresa).filter(Boolean))].sort(),
    [registros],
  );

  // ===== Lista filtrada =====
  const filtrados = useMemo(() => {
    return registros
      .filter((r) => {
        // Cancelados só aparecem se marcados no filtro.
        if (r.cancelado && !statusSelecionados.includes("cancelado")) {
          return false;
        }
        // Pagos somem por padrão; reaparecem se "Pago" estiver no filtro.
        if (r.pago && !statusSelecionados.includes("pago")) {
          return false;
        }

        // Quando há status marcados, mostra somente quem tem ALGUM deles.
        if (statusSelecionados.length > 0) {
          const algum = statusSelecionados.some(
            (k) => (r as unknown as Record<string, boolean>)[k],
          );
          if (!algum) return false;
        }

        if (fEmpresa && r.empresa !== fEmpresa) return false;

        if (busca) {
          const q = busca.toLowerCase();
          return (
            r.numero.toLowerCase().includes(q) ||
            r.empresa.toLowerCase().includes(q) ||
            r.cnpj.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        // Ordena por data de pagamento (mais próxima primeiro); sem data ao fim.
        const da = a.dataPagamento || "9999-99-99";
        const db = b.dataPagamento || "9999-99-99";
        if (da !== db) return da.localeCompare(db);
        return b.numero.localeCompare(a.numero);
      });
  }, [registros, busca, fEmpresa, statusSelecionados]);

  const temFiltro = !!(busca || fEmpresa || statusSelecionados.length);

  const toggleStatusFiltro = (key: string) => {
    setStatusSelecionados((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // ===== Dados do Resumo de recebimentos =====
  // Considera somente registros PAGOS, agrupados por data de pagamento.
  const resumo = useMemo(() => {
    const pagos = registros
      .filter((r) => r.pago && !r.cancelado)
      .map((r) => ({
        data: r.dataPagamento || r.data || "",
        cliente: r.empresa || "—",
        valor: r.total || 0,
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Total por dia: preenche a coluna da direita apenas na última linha do dia.
    const totalPorDia = new Map<string, number>();
    for (const l of pagos) {
      totalPorDia.set(l.data, (totalPorDia.get(l.data) || 0) + l.valor);
    }
    // Marca a última ocorrência de cada data para exibir o total do dia.
    const ultimaLinhaDoDia = new Map<string, number>();
    pagos.forEach((l, i) => ultimaLinhaDoDia.set(l.data, i));

    const linhas = pagos.map((l, i) => ({
      ...l,
      totalDia:
        ultimaLinhaDoDia.get(l.data) === i ? totalPorDia.get(l.data)! : null,
    }));

    const totalGeral = pagos.reduce((s, l) => s + l.valor, 0);
    return { linhas, totalGeral };
  }, [registros]);

  return (
    <div className="space-y-4">
      {/* Cabeçalho + botão Resumo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-text">
            Controle Financeiro
          </h1>
          <p className="text-[12px] text-text-faint">
            Recebimentos por orçamento e contrato.
          </p>
        </div>
        <Button
          variant="primary"
          icon={<ClipboardList size={16} />}
          onClick={() => setResumoAberto(true)}
        >
          Resumo
        </Button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Buscar por número, empresa ou CNPJ..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-3 sm:flex-nowrap">
          <Select value={fEmpresa} onChange={(e) => setFEmpresa(e.target.value)}>
            <option value="">Todas empresas</option>
            {empresas.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>

          {/* Filtro Status financeiro — checkboxes (Pago / Atrasado / Cancelado) */}
          <div className="relative" ref={statusRef}>
            <button
              type="button"
              onClick={() => setStatusAberto((v) => !v)}
              className="flex w-full min-w-[150px] items-center justify-between gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[14px] text-text transition hover:border-primary"
            >
              <span className="truncate">
                {statusSelecionados.length === 0
                  ? "Status"
                  : `Status (${statusSelecionados.length})`}
              </span>
              <ChevronDown size={16} className="shrink-0 text-text-faint" />
            </button>
            {statusAberto && (
              <div className="absolute right-0 z-40 mt-1 w-52 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
                {STATUS_FIN.map((s) => {
                  const marcado = statusSelecionados.includes(s.key);
                  return (
                    <label
                      key={s.key}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-text transition hover:bg-surface-offset"
                    >
                      <input
                        type="checkbox"
                        checked={marcado}
                        onChange={() => toggleStatusFiltro(s.key)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                      <span>{s.label}</span>
                    </label>
                  );
                })}
                {statusSelecionados.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setStatusSelecionados([])}
                    className="mt-1 w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-primary transition hover:bg-primary-soft"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
            )}
          </div>

          {temFiltro && (
            <Button
              variant="secondary"
              onClick={() => {
                setBusca("");
                setFEmpresa("");
                setStatusSelecionados([]);
              }}
              title="Limpar filtros"
              className="px-2"
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Nº</th>
              <th className="px-3 py-2.5 font-medium">Data</th>
              <th className="px-3 py-2.5 font-medium">Empresa</th>
              <th className="px-3 py-2.5 font-medium">Valor Total</th>
              <th className="px-3 py-2.5 font-medium">Data Pagamento</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Nenhum recebimento pendente.
                </td>
              </tr>
            ) : (
              filtrados.map((r) => {
                const emEdicao = editId === r.id;
                const cancelado = r.cancelado;
                const vencido = estaVencido(r) || r.atrasado;

                return (
                  <tr
                    key={`${r.tipoRegistro}-${r.id}`}
                    className={
                      cancelado
                        ? "border-b border-slate-200 bg-slate-100 !text-black last:border-0"
                        : "border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    }
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {r.numero}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {formatDataBR(r.data)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="truncate font-medium text-slate-900">
                        {r.empresa || "—"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {r.cnpj || "—"}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {formatBRL(r.total)}
                    </td>
                    {/* Data de pagamento — editável inline (paulodick) */}
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={rascunhoData}
                            onChange={(e) => setRascunhoData(e.target.value)}
                            className="min-w-[140px]"
                          />
                          <button
                            onClick={() => salvarDataPagamento(r)}
                            title="Salvar data"
                            className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <Calendar size={16} />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            title="Cancelar"
                            className="rounded-md p-1.5 text-rose-600 transition hover:bg-rose-50"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={!podeEditar}
                          onClick={() => {
                            setEditId(r.id);
                            setRascunhoData(r.dataPagamento || "");
                          }}
                          title={
                            podeEditar
                              ? "Definir data prevista do recebimento"
                              : undefined
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition ${
                            r.dataPagamento
                              ? vencido && !r.pago
                                ? "font-semibold text-rose-600"
                                : "text-slate-700"
                              : "text-slate-400"
                          } ${podeEditar ? "hover:bg-slate-100" : "cursor-default"}`}
                        >
                          <Calendar size={14} className="shrink-0" />
                          {r.dataPagamento
                            ? formatDataBR(r.dataPagamento)
                            : "definir"}
                        </button>
                      )}
                    </td>
                    {/* Botões de status financeiro */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {/* Pago — texto verde (padrão) */}
                        <button
                          type="button"
                          onClick={() => togglePago(r)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            r.pago
                              ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300"
                              : "bg-surface-offset text-emerald-600 hover:bg-emerald-50"
                          }`}
                        >
                          Pago
                        </button>
                        {/* Atrasado — texto vermelho */}
                        <button
                          type="button"
                          onClick={() => toggleAtrasado(r)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
                            r.atrasado
                              ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300"
                              : "bg-surface-offset text-rose-600 hover:bg-rose-50"
                          }`}
                        >
                          Atrasado
                        </button>
                        {/* Cancelado — fundo vermelho, texto branco em negrito */}
                        <button
                          type="button"
                          onClick={() => toggleCancelado(r)}
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                            r.cancelado
                              ? "bg-rose-600 text-white ring-1 ring-rose-700"
                              : "bg-rose-600 text-white opacity-70 hover:opacity-100"
                          }`}
                        >
                          Cancelado
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 text-[11px] text-text-faint">
        <span>
          Dica: defina a Data Pagamento; se ela vencer sem marcar Pago, o item
          fica Atrasado automaticamente. Pagos saem da lista (reveja pelo filtro
          Status). Cancelado oculta o item também no Controle.
        </span>
      </div>

      {/* Modal Resumo de recebimentos */}
      <Modal
        open={resumoAberto}
        onClose={() => setResumoAberto(false)}
        title="Resumo de recebimentos"
        wide
        footer={
          <Button variant="ghost" onClick={() => setResumoAberto(false)}>
            Fechar
          </Button>
        }
      >
        <div className="p-1">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-medium">Data</th>
                  <th className="px-3 py-2 font-medium">Cliente</th>
                  <th className="px-3 py-2 text-right font-medium">Valor</th>
                  <th className="px-3 py-2 text-right font-medium">
                    Total do dia
                  </th>
                </tr>
              </thead>
              <tbody>
                {resumo.linhas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-slate-500"
                    >
                      Nenhum recebimento marcado como Pago.
                    </td>
                  </tr>
                ) : (
                  resumo.linhas.map((l, i) => (
                    <tr
                      key={i}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-2 text-slate-700">
                        {formatDataBR(l.data)}
                      </td>
                      <td className="px-3 py-2 text-slate-900">{l.cliente}</td>
                      <td className="px-3 py-2 text-right text-slate-700">
                        {formatBRL(l.valor)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {l.totalDia != null ? formatBRL(l.totalDia) : ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {resumo.linhas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-300 bg-slate-50">
                    <td
                      colSpan={3}
                      className="px-3 py-2.5 text-right font-semibold text-slate-700"
                    >
                      Total geral
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold text-emerald-700">
                      {formatBRL(resumo.totalGeral)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Modal>
    </div>
  );
}
