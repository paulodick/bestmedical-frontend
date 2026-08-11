import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Calendar,
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import type { Orcamento, Proposta } from "../types";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, StatusPill } from "../components/ui";
import {
  formatBRL,
  formatDataBR,
  hojeISO,
  parseCondicaoPagamento,
  formatCondicaoPagamentoInput,
} from "../lib/format";
import { totalFinal } from "../lib/calc";
import { api, API_ENABLED } from "../lib/api";

// ===== Recebível avulso (manual) exposto pela API =====
interface Recebivel {
  id: string;
  data: string;
  empresa: string;
  cnpj: string | null;
  descricao: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  // Condição de pagamento (texto livre, ex.: "Antecipado", "30 dias") —
  // alternativa à dataPagamento quando ainda não há uma data definida.
  condicaoPagamento: string | null;
  observacoes: string | null;
}

// Estado inicial de um recebível avulso novo.
function recebivelVazio(): Omit<Recebivel, "id"> {
  return {
    data: hojeISO(),
    empresa: "",
    cnpj: "",
    descricao: "",
    valor: 0,
    pago: false,
    dataPagamento: null,
    condicaoPagamento: null,
    observacoes: "",
  };
}

// ===== Registro unificado (orçamento | proposta | recebível avulso) =====
type TipoRegistro = "orcamento" | "proposta" | "recebivel";
interface Registro {
  tipoRegistro: TipoRegistro;
  id: string;
  numero: string;
  data: string;
  empresa: string;
  cnpj: string;
  total: number;
  dataPagamento?: string | null;
  condicaoPagamento?: string | null;
  pago: boolean;
  atrasado: boolean;
  cancelado: boolean;
  orcamento?: Orcamento;
  proposta?: Proposta;
  recebivel?: Recebivel;
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

export function ControleFinanceiro({
  onEdit,
  onEditProposta,
}: {
  // Abrem o orçamento/proposta para edição (mesmo fluxo do Controle).
  onEdit?: (orc: Orcamento) => void;
  onEditProposta?: (prop: Proposta) => void;
} = {}) {
  const { orcamentos, atualizar } = useStore();
  const { user } = useAuth();

  // Só o admin master (paulodick) pode editar campos direto na tabela.
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [propostas, setPropostas] = useState<Proposta[]>([]);
  // Recebíveis avulsos (manuais), carregados da API.
  const [recebiveis, setRecebiveis] = useState<Recebivel[]>([]);

  // Modal de novo/editar recebível avulso.
  const [recModalAberto, setRecModalAberto] = useState(false);
  const [recEditId, setRecEditId] = useState<string | null>(null);
  const [recForm, setRecForm] = useState<Omit<Recebivel, "id">>(
    recebivelVazio(),
  );
  const [recSalvando, setRecSalvando] = useState(false);
  const [recExcluirId, setRecExcluirId] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);

  // Ordenação da tabela — clique no cabeçalho da coluna. Padrão preserva o
  // comportamento antigo (data de pagamento mais próxima primeiro).
  type CampoOrdenacao = "numero" | "data" | "empresa" | "total" | "dataPagamento";
  const [sortCampo, setSortCampo] = useState<CampoOrdenacao>("dataPagamento");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const ordenarPor = (campo: CampoOrdenacao) => {
    if (sortCampo === campo) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCampo(campo);
      // Empresa: A-Z por padrão. Datas: mais próxima/antiga primeiro. Nº e
      // Valor: maior primeiro.
      setSortDir(campo === "empresa" || campo === "dataPagamento" ? "asc" : "desc");
    }
  };
  const [statusAberto, setStatusAberto] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  // Edição inline da data de pagamento — campo único (texto livre com
  // parsing automático de data, ver parseCondicaoPagamento em lib/format.ts).
  const [editId, setEditId] = useState<string | null>(null);
  const [rascunhoCondPag, setRascunhoCondPag] = useState("");

  // Modal de Resumo de recebimentos
  const [resumoAberto, setResumoAberto] = useState(false);

  // Carrega as propostas da API.
  const recarregarPropostas = () => {
    if (!API_ENABLED) return;
    api
      // pageSize alto o suficiente para trazer todas as propostas de uma vez.
      .listarPropostas("?order=data_desc&pageSize=5000")
      .then((r) => setPropostas(r.data as Proposta[]))
      .catch((e) => console.error("Falha ao carregar propostas:", e));
  };

  // Carrega os recebíveis avulsos da API.
  const recarregarRecebiveis = () => {
    if (!API_ENABLED) return;
    api
      .listarRecebiveis("?pageSize=5000")
      .then((r) => setRecebiveis((r.data as Recebivel[]) || []))
      .catch((e) => console.error("Falha ao carregar recebíveis:", e));
  };

  useEffect(() => {
    recarregarPropostas();
    recarregarRecebiveis();
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
    // Recebível avulso: atualiza otimista e persiste via API.
    if (r.tipoRegistro === "recebivel") {
      setRecebiveis((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, ...patch } : x)),
      );
      if (API_ENABLED) {
        api
          .atualizarRecebivel(r.id, patch)
          .then((rec) =>
            setRecebiveis((prev) =>
              prev.map((x) => (x.id === r.id ? (rec as Recebivel) : x)),
            ),
          )
          .catch((e) => console.error("Falha ao atualizar recebível:", e));
      }
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
    const { dataPagamento, condicaoPagamento } =
      parseCondicaoPagamento(rascunhoCondPag);
    salvarStatus(r, { dataPagamento, condicaoPagamento });
    setEditId(null);
  };

  // ===== Recebíveis avulsos: modal e ações =====
  const abrirNovoRecebivel = () => {
    setRecEditId(null);
    setRecForm(recebivelVazio());
    setRecModalAberto(true);
  };

  const abrirEdicaoRecebivel = (rec: Recebivel) => {
    setRecEditId(rec.id);
    setRecForm({
      data: rec.data,
      empresa: rec.empresa,
      cnpj: rec.cnpj || "",
      descricao: rec.descricao || "",
      valor: rec.valor,
      pago: rec.pago,
      dataPagamento: rec.dataPagamento,
      condicaoPagamento: rec.condicaoPagamento,
      observacoes: rec.observacoes || "",
    });
    setRecModalAberto(true);
  };

  const salvarRecebivel = async () => {
    if (!recForm.empresa.trim()) {
      alert("Informe a empresa/cliente do recebível.");
      return;
    }
    setRecSalvando(true);
    const payload = {
      ...recForm,
      cnpj: recForm.cnpj || undefined,
      descricao: recForm.descricao || undefined,
      observacoes: recForm.observacoes || undefined,
      dataPagamento: recForm.dataPagamento || undefined,
    };
    try {
      if (recEditId) await api.atualizarRecebivel(recEditId, payload);
      else await api.criarRecebivel(payload);
      setRecModalAberto(false);
      recarregarRecebiveis();
    } catch (e) {
      alert("Erro ao salvar o recebível: " + (e as Error).message);
    } finally {
      setRecSalvando(false);
    }
  };

  const confirmarExclusaoRecebivel = async () => {
    if (!recExcluirId) return;
    try {
      await api.removerRecebivel(recExcluirId);
      setRecExcluirId(null);
      recarregarRecebiveis();
    } catch (e) {
      alert("Erro ao excluir: " + (e as Error).message);
    }
  };

  // Registrar pagamento: marca Pago e define a data de pagamento (hoje se vazia).
  const registrarPagamento = (r: Registro) => {
    salvarStatus(r, {
      pago: true,
      atrasado: false,
      dataPagamento: r.dataPagamento || hojeISO(),
    });
  };

  // ===== Une orçamentos + propostas em registros =====
  const registros = useMemo<Registro[]>(() => {
    const dosOrc: Registro[] = orcamentos.filter((o) => !!o.aprovado).map((o) => ({
      tipoRegistro: "orcamento",
      id: o.id,
      numero: o.numero,
      data: o.data,
      empresa: o.empresa,
      cnpj: o.cnpj,
      total: totalFinal(o),
      dataPagamento: o.dataPagamento ?? null,
      condicaoPagamento: o.condicaoPagamento ?? null,
      pago: !!o.pago,
      atrasado: !!o.atrasado,
      cancelado: !!o.cancelado,
      orcamento: o,
    }));
    // Contratos (propostas) só entram no Controle Financeiro depois que a
    // data de início do contrato é preenchida na página da proposta.
    // Sem essa data, o pagamento mensal ainda não foi ativado.
    const dasProp: Registro[] = propostas
      .filter((p) => !!p.assinado)
      .map((p) => ({
        tipoRegistro: "proposta",
        id: p.id,
        numero: p.numero,
        data: p.data,
        empresa: p.empresa,
        cnpj: p.cnpj,
        total: p.total,
        dataPagamento: p.dataPagamento ?? null,
        condicaoPagamento: p.condicaoPagamento ?? null,
        pago: !!p.pago,
        atrasado: !!p.atrasado,
        cancelado: !!p.cancelado,
        proposta: p,
      }));
    // Recebíveis avulsos (manuais) entram diretamente na lista.
    const dosRec: Registro[] = recebiveis.map((rec) => ({
      tipoRegistro: "recebivel",
      id: rec.id,
      numero: "\u2014",
      data: rec.data,
      empresa: rec.empresa,
      cnpj: rec.cnpj || "",
      total: rec.valor,
      dataPagamento: rec.dataPagamento ?? null,
      condicaoPagamento: rec.condicaoPagamento ?? null,
      pago: !!rec.pago,
      atrasado: false,
      cancelado: false,
      recebivel: rec,
    }));
    return [...dosOrc, ...dasProp, ...dosRec];
  }, [orcamentos, propostas, recebiveis]);

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
        let cmp = 0;
        switch (sortCampo) {
          case "data":
            cmp = a.data.localeCompare(b.data);
            break;
          case "empresa":
            cmp = a.empresa.localeCompare(b.empresa, "pt-BR", {
              sensitivity: "base",
            });
            break;
          case "total":
            cmp = a.total - b.total;
            break;
          case "dataPagamento": {
            // Sem data de pagamento sempre vai para o fim, nas duas direções.
            const da = a.dataPagamento || "9999-99-99";
            const db = b.dataPagamento || "9999-99-99";
            cmp = da.localeCompare(db);
            break;
          }
          case "numero":
          default:
            cmp = a.numero.localeCompare(b.numero);
            break;
        }
        if (cmp === 0) cmp = b.numero.localeCompare(a.numero);
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [registros, busca, fEmpresa, statusSelecionados, sortCampo, sortDir]);

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
        <div className="flex flex-wrap gap-2">
          {podeEditar && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={abrirNovoRecebivel}
            >
              Novo recebível
            </Button>
          )}
          <Button
            variant="secondary"
            icon={<ClipboardList size={16} />}
            onClick={() => setResumoAberto(true)}
          >
            Resumo
          </Button>
        </div>
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
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => ordenarPor("numero")}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                  title="Ordenar por número"
                >
                  Nº
                  {sortCampo === "numero" ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )
                  ) : (
                    <ArrowUpDown size={13} className="text-slate-300" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => ordenarPor("data")}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                  title="Ordenar por data"
                >
                  Data
                  {sortCampo === "data" ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )
                  ) : (
                    <ArrowUpDown size={13} className="text-slate-300" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => ordenarPor("empresa")}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                  title="Ordenar por ordem alfabética"
                >
                  Empresa
                  {sortCampo === "empresa" ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )
                  ) : (
                    <ArrowUpDown size={13} className="text-slate-300" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => ordenarPor("total")}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                  title="Ordenar por valor"
                >
                  Valor Total
                  {sortCampo === "total" ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )
                  ) : (
                    <ArrowUpDown size={13} className="text-slate-300" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">
                <button
                  type="button"
                  onClick={() => ordenarPor("dataPagamento")}
                  className="inline-flex items-center gap-1 font-medium text-slate-500 hover:text-slate-900"
                  title="Ordenar por data de pagamento"
                >
                  Data Pagamento
                  {sortCampo === "dataPagamento" ? (
                    sortDir === "asc" ? (
                      <ChevronUp size={13} />
                    ) : (
                      <ChevronDown size={13} />
                    )
                  ) : (
                    <ArrowUpDown size={13} className="text-slate-300" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-center font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Nenhum recebimento pendente.
                </td>
              </tr>
            ) : (
              filtrados.map((r) => {
                const emEdicao = editId === r.id;
                const cancelado = r.cancelado;
                const vencido = estaVencido(r) || r.atrasado;

                // Número clicável: abre o orçamento/proposta correspondente
                // (mesmo fluxo de edição do Controle). Só fica ativo quando o
                // callback existe e o documento completo está disponível.
                const abrirDocumento =
                  r.tipoRegistro === "proposta"
                    ? onEditProposta && r.proposta
                      ? () => onEditProposta(r.proposta as Proposta)
                      : undefined
                    : onEdit && r.orcamento
                      ? () => onEdit(r.orcamento as Orcamento)
                      : undefined;

                // Parcelamento (só orçamentos): quando o orçamento foi
                // dividido em 2+ parcelas na tela Novo Orçamento, mostra
                // uma sub-linha por parcela logo abaixo, com o valor e a
                // data/condição de cada uma.
                const subParcelas =
                  r.tipoRegistro === "orcamento" &&
                  r.orcamento &&
                  r.orcamento.numParcelas > 1 &&
                  r.orcamento.parcelas.length > 1
                    ? r.orcamento.parcelas
                    : [];

                return (
                  <Fragment key={`${r.tipoRegistro}-${r.id}`}>
                  <tr
                    className={
                      cancelado
                        ? "border-b border-slate-200 bg-slate-100 !text-black last:border-0"
                        : subParcelas.length > 0
                          ? "border-b-0 hover:bg-slate-50/50"
                          : "border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                    }
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {abrirDocumento ? (
                        <span
                          onClick={abrirDocumento}
                          className="cursor-pointer text-blue-600 transition-colors hover:underline"
                          title={
                            r.tipoRegistro === "proposta"
                              ? "Clique para abrir esta proposta"
                              : "Clique para abrir este orçamento"
                          }
                        >
                          {r.numero}
                        </span>
                      ) : (
                        r.numero
                      )}
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
                    {/* Data de pagamento — campo único que aceita data
                        (dd/mm/aaaa etc.) ou texto livre (ex.: "Antecipado",
                        "30 dias"). Ver parseCondicaoPagamento. */}
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="text"
                            value={rascunhoCondPag}
                            onChange={(e) => setRascunhoCondPag(e.target.value)}
                            placeholder="10/09/2026, Antecipado, 30 dias..."
                            className="min-w-[160px]"
                          />
                          <button
                            onClick={() => salvarDataPagamento(r)}
                            title="Salvar"
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
                            setRascunhoCondPag(
                              formatCondicaoPagamentoInput(
                                r.dataPagamento,
                                r.condicaoPagamento,
                              ),
                            );
                          }}
                          title={
                            podeEditar
                              ? "Definir data prevista (ou condição de pagamento, em texto livre)"
                              : undefined
                          }
                          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] transition ${
                            r.dataPagamento || r.condicaoPagamento
                              ? vencido && !r.pago
                                ? "font-semibold text-rose-600"
                                : "text-slate-700"
                              : "text-slate-400"
                          } ${podeEditar ? "hover:bg-slate-100" : "cursor-default"}`}
                        >
                          <Calendar size={14} className="shrink-0" />
                          {r.dataPagamento
                            ? formatDataBR(r.dataPagamento)
                            : r.condicaoPagamento || "definir"}
                        </button>
                      )}
                    </td>
                    {/* Botões de status financeiro — mesmo padrão (StatusPill)
                        usado na página Controle. */}
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusPill
                          on={r.pago}
                          label="Pago"
                          onClick={() => togglePago(r)}
                          interactive
                        />
                        <StatusPill
                          on={r.atrasado}
                          label="Atrasado"
                          onClick={() => toggleAtrasado(r)}
                          interactive
                          tom="danger"
                        />
                        <StatusPill
                          on={r.cancelado}
                          label="Cancelado"
                          onClick={() => toggleCancelado(r)}
                          interactive
                          tom="danger"
                        />
                      </div>
                    </td>
                    {/* Ações: registrar pagamento (todos) + editar/excluir (avulsos) */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        {podeEditar && !r.pago && !cancelado && (
                          <button
                            type="button"
                            onClick={() => registrarPagamento(r)}
                            title="Registrar pagamento"
                            className="rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {podeEditar && r.tipoRegistro === "recebivel" && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                abrirEdicaoRecebivel(r.recebivel as Recebivel)
                              }
                              title="Editar recebível"
                              className="rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRecExcluirId(r.id)}
                              title="Excluir recebível"
                              className="rounded-md p-1.5 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                  {subParcelas.map((p, i) => (
                    <tr
                      key={`${r.tipoRegistro}-${r.id}-parcela-${p.id}`}
                      className={
                        cancelado
                          ? "border-b border-slate-200 bg-slate-100/70 !text-black last:border-0"
                          : i === subParcelas.length - 1
                            ? "border-b border-slate-100 bg-slate-50/40 last:border-0"
                            : "border-b-0 bg-slate-50/40"
                      }
                    >
                      <td className="px-3 py-1.5 pl-7 text-[12px] text-slate-400">
                        ↳ {p.numero}/{subParcelas.length}
                      </td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5 text-[13px] text-slate-600">
                        {formatBRL(p.valor)}
                      </td>
                      <td className="px-3 py-1.5 text-[13px] text-slate-600">
                        {formatCondicaoPagamentoInput(p.data, p.condicaoVencimento) || "—"}
                      </td>
                      <td className="px-3 py-1.5" />
                      <td className="px-3 py-1.5" />
                    </tr>
                  ))}
                  </Fragment>
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

      {/* Modal criar/editar recebível avulso */}
      <Modal
        open={recModalAberto}
        onClose={() => setRecModalAberto(false)}
        title={recEditId ? "Editar recebível" : "Novo recebível"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRecModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvarRecebivel} disabled={recSalvando}>
              {recSalvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Data"
              type="date"
              value={recForm.data}
              onChange={(e) => setRecForm({ ...recForm, data: e.target.value })}
            />
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={recForm.valor || ""}
              onChange={(e) =>
                setRecForm({ ...recForm, valor: Number(e.target.value) || 0 })
              }
            />
          </div>
          <Input
            label="Empresa / Cliente"
            value={recForm.empresa}
            onChange={(e) =>
              setRecForm({ ...recForm, empresa: e.target.value })
            }
            required
          />
          <Input
            label="CNPJ (opcional)"
            value={recForm.cnpj || ""}
            onChange={(e) => setRecForm({ ...recForm, cnpj: e.target.value })}
          />
          <Input
            label="Descrição"
            value={recForm.descricao || ""}
            onChange={(e) =>
              setRecForm({ ...recForm, descricao: e.target.value })
            }
          />
          <div className="rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={recForm.pago}
                onChange={(e) =>
                  setRecForm({
                    ...recForm,
                    pago: e.target.checked,
                    dataPagamento: e.target.checked
                      ? recForm.dataPagamento || hojeISO()
                      : null,
                  })
                }
              />
              <span className="font-medium text-text">Já foi recebido</span>
            </label>
            {recForm.pago && (
              <div className="mt-3">
                <Input
                  label="Data do recebimento"
                  type="date"
                  value={recForm.dataPagamento || ""}
                  onChange={(e) =>
                    setRecForm({ ...recForm, dataPagamento: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <Textarea
            label="Observações"
            rows={2}
            value={recForm.observacoes || ""}
            onChange={(e) =>
              setRecForm({ ...recForm, observacoes: e.target.value })
            }
          />
        </div>
      </Modal>

      {/* Modal confirmar exclusão de recebível */}
      <Modal
        open={!!recExcluirId}
        onClose={() => setRecExcluirId(null)}
        title="Excluir recebível"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRecExcluirId(null)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={confirmarExclusaoRecebivel}
              icon={<X size={16} />}
              className="!bg-red-600 !text-white hover:!bg-red-700"
            >
              Excluir
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text">
          Tem certeza que deseja excluir este recebível avulso? Esta ação não
          pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
