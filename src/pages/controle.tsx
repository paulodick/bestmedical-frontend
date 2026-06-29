import { useEffect, useMemo, useState } from "react";
import { Search, Eye, X, FileDown, Loader2, FileText, FileSignature } from "lucide-react";
import { useStore } from "../store";
import type { Orcamento, Proposta } from "../types";
import { STATUS_FIELDS } from "../types";
import { Modal } from "../components/Modal";
import { OrcamentoPreview } from "../components/OrcamentoPreview";
import { Button, Input, Select, StatusPill } from "../components/ui";
import { formatBRL, formatDataBR } from "../lib/format";
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
  orcamento?: Orcamento;
  proposta?: Proposta;
}

// Lê um status booleano de controle a partir do objeto subjacente.
function statusOn(r: Registro, key: string): boolean {
  const fonte =
    r.tipoRegistro === "orcamento"
      ? (r.orcamento as unknown as Record<string, unknown>)
      : (r.proposta as unknown as Record<string, unknown>);
  return !!fonte?.[key];
}

export function Controle({ onEdit, onEditProposta, onAbrirOs, onAbrirContrato }: ControleProps = {}) {
  const { orcamentos, atualizar } = useStore();

  // Propostas são carregadas localmente (no modo mock ficam vazias).
  const [propostas, setPropostas] = useState<Proposta[]>([]);

  const [fTipo, setFTipo] = useState<"" | TipoRegistro>("");
  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [fCnpj, setFCnpj] = useState("");
  const [fData, setFData] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [preview, setPreview] = useState<Orcamento | null>(null);
  // ID do registro cujo PDF está sendo gerado (para mostrar o spinner).
  const [pdfCarregando, setPdfCarregando] = useState<string | null>(null);
  const [pdfErro, setPdfErro] = useState<string | null>(null);

  // Carrega as propostas da API (mesma cadência da lista de orçamentos).
  useEffect(() => {
    if (!API_ENABLED) return;
    let ativo = true;
    api
      .listarPropostas("?order=data_desc&pageSize=100")
      .then((r) => {
        if (ativo) setPropostas(r.data as Proposta[]);
      })
      .catch((e) => console.error("Falha ao carregar propostas:", e));
    return () => {
      ativo = false;
    };
  }, []);

  // Abre o PDF gerado pelo servidor (rota por tipo). Disponível com API.
  const handlePdf = async (r: Registro) => {
    if (!r.id) return;
    setPdfErro(null);
    setPdfCarregando(r.id);
    try {
      if (r.tipoRegistro === "proposta") await api.abrirPdfProposta(r.id);
      else await api.abrirPdf(r.id);
    } catch (e) {
      setPdfErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setPdfCarregando(null);
    }
  };

  // Alterna um status: orçamento via store; proposta via API + otimista local.
  const toggleStatus = (r: Registro, key: string) => {
    const novo = !statusOn(r, key);
    if (r.tipoRegistro === "orcamento") {
      atualizar(r.id, { [key]: novo });
      return;
    }
    setPropostas((prev) =>
      prev.map((p) => (p.id === r.id ? { ...p, [key]: novo } : p)),
    );
    if (API_ENABLED) {
      api
        .atualizarStatusProposta(r.id, { [key]: novo })
        .catch((e) => console.error("Falha ao atualizar status da proposta:", e));
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
      proposta: p,
    }));
    return [...dosOrcamentos, ...dasPropostas];
  }, [orcamentos, propostas]);

  // Base após o filtro de tipo (alimenta os selects de empresa/CNPJ).
  const base = useMemo(
    () => (fTipo ? registros.filter((r) => r.tipoRegistro === fTipo) : registros),
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
        if (fStatus && !statusOn(r, fStatus)) return false;
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
  }, [base, busca, fEmpresa, fCnpj, fData, fStatus]);

  const temFiltro = !!(fTipo || busca || fEmpresa || fCnpj || fData || fStatus);

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
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
            <option value="">Todos status</option>
            {STATUS_FIELDS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          {temFiltro && (
            <Button
              variant="secondary"
              onClick={() => {
                setFTipo("");
                setBusca("");
                setFEmpresa("");
                setFCnpj("");
                setFData("");
                setFStatus("");
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
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
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
                return (
                  <tr
                    key={`${r.tipoRegistro}-${r.id}`}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-3 py-2.5 font-medium text-slate-900">
                      {abrirEdicao ? (
                        <span
                          onClick={abrirEdicao}
                          className="cursor-pointer hover:underline text-blue-600 transition-colors"
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
                    <td className="px-3 py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {STATUS_FIELDS.map((s) => (
                          <StatusPill
                            key={s.key}
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
                        {/* Ícone de Contrato — só para propostas aprovadas */}
                        {r.tipoRegistro === "proposta" &&
                          r.proposta?.aprovado &&
                          onAbrirContrato && (
                            <button
                              onClick={() => onAbrirContrato(r.id)}
                              title="Abrir Contrato"
                              className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-success-soft hover:text-success"
                            >
                              <FileSignature size={16} />
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

      {/* Legenda compacta de status (mobile-friendly) */}
      <div className="flex flex-wrap gap-2 text-[11px] text-text-faint">
        <span>Dica: altere qualquer status diretamente na tabela.</span>
      </div>

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
                  <StatusPill key={s.key} on={!!preview[s.key as keyof Orcamento]} label={s.label} />
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
            <Button variant="ghost" onClick={() => setPreview(null)}>Fechar</Button>
          </>
        }
      >
        <div className="bg-slate-100 p-4">
          {preview && <OrcamentoPreview o={preview} />}
        </div>
      </Modal>

      {/* Toast de erro ao gerar PDF */}
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
    </div>
  );
}
