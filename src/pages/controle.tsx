import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Eye,
  X,
  FileDown,
  Loader2,
  FileText,
  FileSignature,
  Upload,
  CheckCircle2,
  ChevronDown,
  Pencil,
  Check,
} from "lucide-react";
import { useStore } from "../store";
import { useAuth } from "../auth";
import type { Orcamento, Proposta } from "../types";
import { STATUS_FIELDS, STATUS_FIELDS_PC } from "../types";
import { Modal } from "../components/Modal";
import { FollowUpModal } from "../components/FollowUpModal";
import { OrcamentoPreview } from "../components/OrcamentoPreview";
import { Button, Input, Select, StatusPill } from "../components/ui";
import {
  formatBRL,
  formatDataBR,
  maskCNPJ,
  parseMoedaInput,
  moedaParaInput,
} from "../lib/format";
import { totalFinal } from "../lib/calc";
import { api, API_ENABLED } from "../lib/api";

// Interface do componente: aceita onEdit (orçamento), onEditProposta e onAbrirOs
interface ControleProps {
  onEdit?: (orcamento: Orcamento) => void;
  // Clique no número de uma proposta (PC-...) abre a tela em modo edição
  onEditProposta?: (proposta: Proposta) => void;
  // Callback chamado ao clicar no ícone de OS (só aparece quando aprovado)
  onAbrirOs?: (orcamentoId: string) => void;
  // Callback ao clicar no ícone de Contrato (só aparece em propostas aprovadas)
  onAbrirContrato?: (propostaId: string) => void;
}

// Registro unificado exibido na tabela de Controle.
// Carrega o objeto original (orçamento ou proposta) para as ações por tipo.
type TipoRegistro = "orcamento" | "proposta";
interface Registro {
  tipoRegistro: TipoRegistro;
  id: string;
  numero: string;
  data: string;
  empresa: string;
  cnpj: string;
  total: number;
  enviadoEm?: string | null;
  orcamento?: Orcamento;
  proposta?: Proposta;
}

// Status que ficam OCULTOS por padrão na lista de Controle.
// Só aparecem quando o usuário marca explicitamente no filtro "Status".
const STATUS_OCULTOS_PADRAO = ["reprovado", "pagamentoRealizado", "vigente"];

// Conjunto de status disponíveis no filtro (união de orçamentos + propostas),
// sem duplicar chaves.
const STATUS_FILTRO: { key: string; label: string }[] = (() => {
  const mapa = new Map<string, string>();
  for (const s of STATUS_FIELDS) mapa.set(s.key as string, s.label);
  for (const s of STATUS_FIELDS_PC) mapa.set(s.key as string, s.label);
  return [...mapa.entries()].map(([key, label]) => ({ key, label }));
})();

// Uma linha é uma Proposta de Contrato (PC) quando o número começa com "PC".
function ehProposta(r: Registro): boolean {
  return r.tipoRegistro === "proposta";
}

// Lê um status booleano de controle a partir do objeto subjacente.
function statusOn(r: Registro, key: string): boolean {
  const fonte =
    r.tipoRegistro === "orcamento"
      ? (r.orcamento as unknown as Record<string, unknown>)
      : (r.proposta as unknown as Record<string, unknown>);
  return !!fonte?.[key];
}

// Calcula o número de dias (inteiro) desde a data de envio até hoje,
// considerando apenas a data (sem hora). Retorna null se não há envio.
function diasDesdeEnvio(enviadoEm?: string | null): number | null {
  if (!enviadoEm) return null;
  const env = new Date(enviadoEm);
  if (isNaN(env.getTime())) return null;
  const hoje = new Date();
  const a = new Date(env.getFullYear(), env.getMonth(), env.getDate());
  const b = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const diff = Math.round((b.getTime() - a.getTime()) / 86_400_000);
  return diff < 0 ? 0 : diff;
}

// Rótulo + cores do "selo" da coluna Enviado, conforme os dias.
function seloEnvio(dias: number | null): {
  texto: string;
  classe: string;
} {
  if (dias === null) {
    return {
      texto: "—",
      classe: "bg-surface-offset text-text-faint",
    };
  }
  if (dias === 0) {
    return {
      texto: "Hoje",
      classe: "bg-emerald-100 text-emerald-700",
    };
  }
  const texto = dias === 1 ? "1 dia" : `${dias} dias`;
  if (dias <= 2) {
    return { texto, classe: "bg-amber-100 text-amber-700" };
  }
  return { texto, classe: "bg-rose-100 text-rose-700" };
}

export function Controle({
  onEdit,
  onEditProposta,
  onAbrirOs,
  onAbrirContrato,
}: ControleProps = {}) {
  const { orcamentos, atualizar, salvar } = useStore();
  const { user } = useAuth();

  // Só o admin master (paulodick) pode editar os campos direto na tabela.
  const podeEditarInline =
    (user?.usuario || "").toLowerCase() === "paulodick";

  // Propostas são carregadas localmente (no modo mock ficam vazias).
  const [propostas, setPropostas] = useState<Proposta[]>([]);

  // ===== Edição inline (Data, Empresa, CNPJ, Valor Total) =====
  // Guarda o id do registro em edição e o rascunho dos campos editáveis.
  const [editId, setEditId] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<{
    data: string;
    empresa: string;
    cnpj: string;
    total: string; // texto do input monetário (reais)
  }>({ data: "", empresa: "", cnpj: "", total: "" });
  const [salvandoInline, setSalvandoInline] = useState(false);
  const [inlineErro, setInlineErro] = useState<string | null>(null);

  const iniciarEdicao = (r: Registro) => {
    setInlineErro(null);
    setEditId(r.id);
    setRascunho({
      data: r.data || "",
      empresa: r.empresa || "",
      cnpj: r.cnpj || "",
      total: moedaParaInput(r.total || 0),
    });
  };

  const cancelarEdicao = () => {
    setEditId(null);
    setInlineErro(null);
  };

  // Salva os campos editados enviando o objeto COMPLETO (PUT), preservando
  // itens, parcelas e status. O Valor Total vira um "total manual" (override).
  const salvarEdicao = async (r: Registro) => {
    const totalReais = parseMoedaInput(rascunho.total);
    const campos = {
      data: rascunho.data,
      empresa: rascunho.empresa.trim(),
      cnpj: rascunho.cnpj.trim(),
      totalManual: totalReais > 0 ? totalReais : null,
    };
    setInlineErro(null);
    setSalvandoInline(true);
    try {
      if (r.tipoRegistro === "orcamento" && r.orcamento) {
        // salvar() faz PUT completo via api.atualizarOrcamento e recarrega.
        salvar({ ...r.orcamento, ...campos });
      } else if (r.tipoRegistro === "proposta" && r.proposta) {
        const atualizada = await api.atualizarProposta(r.id, {
          ...r.proposta,
          ...campos,
        });
        setPropostas((prev) =>
          prev.map((p) => (p.id === r.id ? (atualizada as Proposta) : p)),
        );
      }
      setEditId(null);
    } catch (e) {
      setInlineErro(
        e instanceof Error ? e.message : "Não foi possível salvar as alterações.",
      );
    } finally {
      setSalvandoInline(false);
    }
  };

  const [fTipo, setFTipo] = useState<"" | TipoRegistro>("");
  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [fCnpj, setFCnpj] = useState("");
  const [fData, setFData] = useState("");
  // Filtro de status agora é multi-seleção (checkboxes). Vazio = padrão.
  const [statusSelecionados, setStatusSelecionados] = useState<string[]>([]);
  const [statusAberto, setStatusAberto] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);

  const [preview, setPreview] = useState<Orcamento | null>(null);
  // ID do registro cujo PDF está sendo gerado (para mostrar o spinner).
  const [pdfCarregando, setPdfCarregando] = useState<string | null>(null);
  const [pdfErro, setPdfErro] = useState<string | null>(null);

  // Follow-up: registro atualmente aberto no modal.
  const [followUpReg, setFollowUpReg] = useState<Registro | null>(null);

  // Upload do contrato assinado: id da proposta em processamento.
  const [uploadCarregando, setUploadCarregando] = useState<string | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const propostaUploadId = useRef<string | null>(null);

  // Carrega as propostas da API (mesma cadência da lista de orçamentos).
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

  // Abre o PDF gerado pelo servidor (rota por tipo). Disponível com API.
  const handlePdf = async (r: Registro) => {
    if (!r.id) return;
    setPdfErro(null);
    setPdfCarregando(r.id);
    try {
      if (r.tipoRegistro === "proposta") await api.abrirPdfProposta(r.id);
      else await api.abrirPdf(r.id);
    } catch (e) {
      setPdfErro(
        e instanceof Error ? e.message : "Não foi possível gerar o PDF.",
      );
    } finally {
      setPdfCarregando(null);
    }
  };

  // Alterna um status: orçamento via store; proposta via API + otimista local.
  const toggleStatus = (r: Registro, key: string) => {
    const novo = !statusOn(r, key);
    // Ao marcar "enviado", registra o momento do envio para a coluna Enviado.
    const extra =
      key === "enviado" && novo ? { enviadoEm: new Date().toISOString() } : {};
    if (r.tipoRegistro === "orcamento") {
      atualizar(r.id, { [key]: novo, ...extra });
      return;
    }
    setPropostas((prev) =>
      prev.map((p) => (p.id === r.id ? { ...p, [key]: novo, ...extra } : p)),
    );
    if (API_ENABLED) {
      api
        .atualizarStatusProposta(r.id, { [key]: novo })
        .then((p) => {
          // Sincroniza com o servidor (inclui enviadoEm calculado lá).
          setPropostas((prev) =>
            prev.map((x) => (x.id === r.id ? (p as Proposta) : x)),
          );
        })
        .catch((e) =>
          console.error("Falha ao atualizar status da proposta:", e),
        );
    }
  };

  // Dispara o seletor de arquivo para o upload do contrato assinado.
  const iniciarUploadContrato = (propostaId: string) => {
    propostaUploadId.current = propostaId;
    uploadInputRef.current?.click();
  };

  // Lê o PDF selecionado e envia em base64 ao servidor.
  const onArquivoSelecionado = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = e.target.files?.[0];
    const propostaId = propostaUploadId.current;
    // Limpa o input para permitir reenviar o mesmo arquivo depois.
    e.target.value = "";
    if (!arquivo || !propostaId) return;

    if (arquivo.type !== "application/pdf") {
      setPdfErro("Selecione um arquivo PDF.");
      return;
    }

    setPdfErro(null);
    setUploadCarregando(propostaId);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(arquivo);
      });
      const atualizada = await api.enviarContratoAssinado(
        propostaId,
        base64,
        arquivo.name,
      );
      // O servidor já marca como "Assinado". Atualiza a linha local.
      setPropostas((prev) =>
        prev.map((p) => (p.id === propostaId ? (atualizada as Proposta) : p)),
      );
    } catch (err) {
      setPdfErro(
        err instanceof Error
          ? err.message
          : "Não foi possível enviar o contrato assinado.",
      );
    } finally {
      setUploadCarregando(null);
      propostaUploadId.current = null;
    }
  };

  // Abre o PDF do contrato assinado carregado.
  const abrirContratoAssinado = async (propostaId: string) => {
    setPdfErro(null);
    try {
      await api.abrirContratoAssinado(propostaId);
    } catch (e) {
      setPdfErro(
        e instanceof Error
          ? e.message
          : "Não foi possível abrir o contrato assinado.",
      );
    }
  };

  // Une orçamentos e propostas num único conjunto de registros.
  const registros = useMemo<Registro[]>(() => {
    const dosOrcamentos: Registro[] = orcamentos.map((o) => ({
      tipoRegistro: "orcamento",
      id: o.id,
      numero: o.numero,
      data: o.data,
      empresa: o.empresa,
      cnpj: o.cnpj,
      total: totalFinal(o),
      enviadoEm: o.enviadoEm ?? null,
      orcamento: o,
    }));
    const dasPropostas: Registro[] = propostas.map((p) => ({
      tipoRegistro: "proposta",
      id: p.id,
      numero: p.numero,
      data: p.data,
      empresa: p.empresa,
      cnpj: p.cnpj,
      total: p.total,
      enviadoEm: p.enviadoEm ?? null,
      proposta: p,
    }));
    return [...dosOrcamentos, ...dasPropostas];
  }, [orcamentos, propostas]);

  // Base após o filtro de tipo (alimenta os selects de empresa/CNPJ).
  const base = useMemo(
    () =>
      fTipo ? registros.filter((r) => r.tipoRegistro === fTipo) : registros,
    [registros, fTipo],
  );

  const empresas = useMemo(
    () => [...new Set(base.map((r) => r.empresa).filter(Boolean))].sort(),
    [base],
  );
  const cnpjs = useMemo(
    () => [...new Set(base.map((r) => r.cnpj).filter(Boolean))].sort(),
    [base],
  );

  const filtrados = useMemo(() => {
    return base
      .filter((r) => {
        if (fEmpresa && r.empresa !== fEmpresa) return false;
        if (fCnpj && r.cnpj !== fCnpj) return false;
        if (fData && r.data !== fData) return false;

        // ===== Regra de status =====
        if (statusSelecionados.length > 0) {
          // Mostra o registro se possuir QUALQUER um dos status marcados.
          const algum = statusSelecionados.some((k) => statusOn(r, k));
          if (!algum) return false;
        } else {
          // Padrão: oculta Reprovado, Pagamento Realizado e Vigente.
          for (const oculto of STATUS_OCULTOS_PADRAO) {
            if (statusOn(r, oculto)) return false;
          }
        }

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
      .sort((a, b) => b.numero.localeCompare(a.numero));
  }, [base, busca, fEmpresa, fCnpj, fData, statusSelecionados]);

  const temFiltro = !!(
    fTipo ||
    busca ||
    fEmpresa ||
    fCnpj ||
    fData ||
    statusSelecionados.length
  );

  const toggleStatusFiltro = (key: string) => {
    setStatusSelecionados((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  return (
    <div className="space-y-4">
      {/* Filtro de tipo (topo) — determina o conjunto exibido */}
      <div className="flex flex-col gap-1 sm:max-w-xs">
        <label className="text-[11px] font-medium text-text-faint">
          Tipo de Proposta
        </label>
        <Select
          value={fTipo}
          onChange={(e) => {
            setFTipo(e.target.value as "" | TipoRegistro);
            // Limpa filtros dependentes que podem não existir no novo conjunto
            setFEmpresa("");
            setFCnpj("");
          }}
        >
          <option value="">Todos</option>
          <option value="orcamento">Orçamentos</option>
          <option value="proposta">Propostas de Contrato</option>
        </Select>
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
          <Select value={fCnpj} onChange={(e) => setFCnpj(e.target.value)}>
            <option value="">Todos CNPJs</option>
            {cnpjs.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Input
            type="date"
            value={fData}
            onChange={(e) => setFData(e.target.value)}
            title="Filtrar por data"
          />

          {/* Filtro Status — dropdown com checkboxes (multi-seleção) */}
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
              <div className="absolute right-0 z-40 mt-1 w-56 rounded-lg border border-border bg-surface p-1.5 shadow-lg">
                {STATUS_FILTRO.map((s) => {
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
                setFTipo("");
                setBusca("");
                setFEmpresa("");
                setFCnpj("");
                setFData("");
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
              <th className="px-3 py-2.5 font-medium">Enviado</th>
              <th className="px-3 py-2.5 font-medium">Nº</th>
              <th className="px-3 py-2.5 font-medium">Data</th>
              <th className="px-3 py-2.5 font-medium">Empresa</th>
              <th className="px-3 py-2.5 font-medium">Valor Total</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-slate-500">
                  Nenhum registro encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((r) => {
                const abrirEdicao =
                  r.tipoRegistro === "proposta"
                    ? onEditProposta
                      ? () => onEditProposta(r.proposta as Proposta)
                      : undefined
                    : onEdit
                      ? () => onEdit(r.orcamento as Orcamento)
                      : undefined;

                const dias = diasDesdeEnvio(r.enviadoEm);
                const selo = seloEnvio(dias);
                const isPC = ehProposta(r);
                const campos = isPC ? STATUS_FIELDS_PC : STATUS_FIELDS;
                const contratoAssinado = r.proposta?.contratoAssinado;
                const emEdicao = editId === r.id;

                return (
                  <tr
                    key={`${r.tipoRegistro}-${r.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >
                    {/* Coluna Enviado — selo de dias + abre o follow-up */}
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setFollowUpReg(r)}
                        title="Registrar / ver follow-up"
                        className={`inline-flex items-center justify-center rounded-md px-2.5 py-1 text-[12px] font-semibold transition hover:ring-2 hover:ring-primary/30 ${selo.classe}`}
                      >
                        {selo.texto}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {abrirEdicao ? (
                        <span
                          onClick={abrirEdicao}
                          className="cursor-pointer text-blue-600 transition-colors hover:underline"
                          title={
                            r.tipoRegistro === "proposta"
                              ? "Clique para editar esta proposta"
                              : "Clique para editar este orçamento"
                          }
                        >
                          {r.numero}
                        </span>
                      ) : (
                        r.numero
                      )}
                    </td>
                    {/* Data — editável inline (paulodick) */}
                    <td className="px-3 py-2.5 text-slate-500">
                      {emEdicao ? (
                        <Input
                          type="date"
                          value={rascunho.data}
                          onChange={(e) =>
                            setRascunho((d) => ({ ...d, data: e.target.value }))
                          }
                          className="min-w-[140px]"
                        />
                      ) : (
                        formatDataBR(r.data)
                      )}
                    </td>
                    {/* Empresa + CNPJ — editáveis inline (paulodick) */}
                    <td className="px-3 py-2.5">
                      {emEdicao ? (
                        <div className="flex flex-col gap-1">
                          <Input
                            value={rascunho.empresa}
                            onChange={(e) =>
                              setRascunho((d) => ({
                                ...d,
                                empresa: e.target.value,
                              }))
                            }
                            placeholder="Empresa"
                            className="min-w-[180px]"
                          />
                          <Input
                            value={rascunho.cnpj}
                            onChange={(e) =>
                              setRascunho((d) => ({
                                ...d,
                                cnpj: maskCNPJ(e.target.value),
                              }))
                            }
                            placeholder="CNPJ"
                            className="min-w-[180px]"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="truncate font-medium text-slate-900">
                            {r.empresa || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.cnpj || "—"}
                          </div>
                        </>
                      )}
                    </td>
                    {/* Valor Total — editável inline (paulodick), vira total manual */}
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {emEdicao ? (
                        <Input
                          inputMode="numeric"
                          value={rascunho.total}
                          onChange={(e) =>
                            setRascunho((d) => ({
                              ...d,
                              total: moedaParaInput(
                                parseMoedaInput(e.target.value),
                              ),
                            }))
                          }
                          placeholder="0,00"
                          className="min-w-[120px] text-right"
                        />
                      ) : (
                        formatBRL(r.total)
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {campos.map((s) => (
                          <StatusPill
                            key={s.key as string}
                            on={statusOn(r, s.key as string)}
                            label={s.label}
                            onClick={() => toggleStatus(r, s.key as string)}
                            interactive
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="inline-flex items-center justify-center gap-1">
                        {/* Edição inline dos campos visíveis — só paulodick */}
                        {podeEditarInline &&
                          (emEdicao ? (
                            <>
                              <button
                                onClick={() => salvarEdicao(r)}
                                disabled={salvandoInline}
                                title="Salvar alterações"
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {salvandoInline ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Check size={16} />
                                )}
                              </button>
                              <button
                                onClick={cancelarEdicao}
                                disabled={salvandoInline}
                                title="Cancelar edição"
                                className="inline-flex items-center justify-center rounded-md p-1.5 text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                              >
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => iniciarEdicao(r)}
                              title="Editar Data, Empresa, CNPJ e Valor Total"
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary"
                            >
                              <Pencil size={16} />
                            </button>
                          ))}
                        <button
                          onClick={() =>
                            r.tipoRegistro === "proposta"
                              ? handlePdf(r)
                              : setPreview(r.orcamento as Orcamento)
                          }
                          title={
                            r.tipoRegistro === "proposta"
                              ? "Visualizar proposta (PDF)"
                              : "Visualizar orçamento"
                          }
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary"
                        >
                          <Eye size={16} />
                        </button>
                        {API_ENABLED && (
                          <button
                            onClick={() => handlePdf(r)}
                            disabled={pdfCarregando === r.id}
                            title="Baixar / abrir PDF"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                          >
                            {pdfCarregando === r.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <FileDown size={16} />
                            )}
                          </button>
                        )}
                        {/* Ícone de OS — só para orçamentos aprovados */}
                        {r.tipoRegistro === "orcamento" &&
                          r.orcamento?.aprovado &&
                          onAbrirOs && (
                            <button
                              onClick={() => onAbrirOs(r.id)}
                              title="Abrir Ordem de Serviço"
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-success-soft hover:text-success"
                            >
                              <FileText size={16} />
                            </button>
                          )}
                        {/* Ícone de Contrato (minuta) — só para propostas aprovadas */}
                        {r.tipoRegistro === "proposta" &&
                          r.proposta?.aprovado &&
                          onAbrirContrato && (
                            <button
                              onClick={() => onAbrirContrato(r.id)}
                              title="Abrir minuta do contrato"
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-success-soft hover:text-success"
                            >
                              <FileSignature size={16} />
                            </button>
                          )}
                        {/* Upload do contrato assinado — só para PC aprovada */}
                        {API_ENABLED &&
                          r.tipoRegistro === "proposta" &&
                          r.proposta?.aprovado && (
                            <button
                              onClick={() => iniciarUploadContrato(r.id)}
                              disabled={uploadCarregando === r.id}
                              title="Carregar contrato assinado (PDF)"
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                            >
                              {uploadCarregando === r.id ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Upload size={16} />
                              )}
                            </button>
                          )}
                        {/* Check verde — abre o contrato assinado carregado */}
                        {r.tipoRegistro === "proposta" && contratoAssinado && (
                          <button
                            onClick={() => abrirContratoAssinado(r.id)}
                            title="Abrir contrato assinado"
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-emerald-600 transition hover:bg-emerald-50"
                          >
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Input oculto para upload do contrato assinado */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onArquivoSelecionado}
      />

      {/* Legenda compacta de status (mobile-friendly) */}
      <div className="flex flex-wrap gap-2 text-[11px] text-text-faint">
        <span>
          Dica: altere qualquer status diretamente na tabela. Clique na coluna
          Enviado para registrar follow-ups.
        </span>
      </div>

      {/* Modal de follow-up */}
      <FollowUpModal
        open={!!followUpReg}
        onClose={() => setFollowUpReg(null)}
        orcamentoId={
          followUpReg?.tipoRegistro === "orcamento" ? followUpReg.id : undefined
        }
        propostaId={
          followUpReg?.tipoRegistro === "proposta" ? followUpReg.id : undefined
        }
        numero={followUpReg?.numero ?? ""}
      />

      <Modal
        open={!!preview}
        onClose={() => setPreview(null)}
        title={`Orçamento ${preview?.numero ?? ""}`}
        wide
        footer={
          <>
            <div className="mr-auto flex flex-wrap gap-1.5">
              {preview &&
                STATUS_FIELDS.map((s) => (
                  <StatusPill
                    key={s.key}
                    on={!!preview[s.key as keyof Orcamento]}
                    label={s.label}
                  />
                ))}
            </div>
            {API_ENABLED && preview?.id && (
              <Button
                variant="secondary"
                icon={
                  pdfCarregando === preview.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <FileDown size={16} />
                  )
                }
                onClick={() =>
                  preview &&
                  handlePdf({
                    tipoRegistro: "orcamento",
                    id: preview.id,
                    numero: preview.numero,
                    data: preview.data,
                    empresa: preview.empresa,
                    cnpj: preview.cnpj,
                    total: totalFinal(preview),
                    orcamento: preview,
                  })
                }
                disabled={pdfCarregando === preview.id}
              >
                {pdfCarregando === preview.id ? "Gerando…" : "Baixar PDF"}
              </Button>
            )}
            <Button variant="ghost" onClick={() => setPreview(null)}>
              Fechar
            </Button>
          </>
        }
      >
        <div className="bg-slate-100 p-4">
          {preview && <OrcamentoPreview o={preview} />}
        </div>
      </Modal>

      {/* Toast de erro ao gerar PDF / upload */}
      {pdfErro && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_.2s_ease] rounded-lg bg-slate-900 px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          <span className="flex items-center gap-2">
            <X size={16} className="text-rose-400" />
            {pdfErro}
            <button
              onClick={() => setPdfErro(null)}
              className="ml-2 rounded p-0.5 text-white/70 hover:text-white"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      {/* Toast de erro ao salvar edição inline */}
      {inlineErro && (
        <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_.2s_ease] rounded-lg bg-slate-900 px-4 py-3 text-[13px] font-medium text-white shadow-lg">
          <span className="flex items-center gap-2">
            <X size={16} className="text-rose-400" />
            {inlineErro}
            <button
              onClick={() => setInlineErro(null)}
              className="ml-2 rounded p-0.5 text-white/70 hover:text-white"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
