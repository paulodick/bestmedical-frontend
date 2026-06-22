import { useMemo, useState } from "react";
import { Search, Eye, X, FileDown, Loader2, FileText } from "lucide-react";
import { useStore } from "../store";
import type { Orcamento } from "../types";
import { STATUS_FIELDS } from "../types";
import { Modal } from "../components/Modal";
import { OrcamentoPreview } from "../components/OrcamentoPreview";
import { Button, Input, Select, StatusPill } from "../components/ui";
import { formatBRL, formatDataBR } from "../lib/format";
import { totalFinal } from "../lib/calc";
import { api, API_ENABLED } from "../lib/api";

// Interface do componente: aceita onEdit e onAbrirOs
interface ControleProps {
  onEdit?: (orcamento: Orcamento) => void;
  // Callback chamado ao clicar no ícone de OS (só aparece quando aprovado)
  onAbrirOs?: (orcamentoId: string) => void;
}

export function Controle({ onEdit, onAbrirOs }: ControleProps = {}) {
  const { orcamentos, atualizar } = useStore();

  const [busca, setBusca] = useState("");
  const [fEmpresa, setFEmpresa] = useState("");
  const [fCnpj, setFCnpj] = useState("");
  const [fData, setFData] = useState("");
  const [fStatus, setFStatus] = useState<string>("");
  const [preview, setPreview] = useState<Orcamento | null>(null);
  // ID do orçamento cujo PDF está sendo gerado (para mostrar o spinner).
  const [pdfCarregando, setPdfCarregando] = useState<string | null>(null);
  const [pdfErro, setPdfErro] = useState<string | null>(null);

  // Abre o PDF gerado pelo servidor. Disponível quando conectado à API.
  const handlePdf = async (o: Orcamento) => {
    if (!o.id) return;
    setPdfErro(null);
    setPdfCarregando(o.id);
    try {
      await api.abrirPdf(o.id);
    } catch (e) {
      setPdfErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setPdfCarregando(null);
    }
  };

  const empresas = useMemo(
    () => [...new Set(orcamentos.map((o) => o.empresa).filter(Boolean))].sort(),
    [orcamentos]
  );
  const cnpjs = useMemo(
    () => [...new Set(orcamentos.map((o) => o.cnpj).filter(Boolean))].sort(),
    [orcamentos]
  );

  const filtrados = useMemo(() => {
    return orcamentos
      .filter((o) => {
        if (fEmpresa && o.empresa !== fEmpresa) return false;
        if (fCnpj && o.cnpj !== fCnpj) return false;
        if (fData && o.data !== fData) return false;
        if (fStatus && !o[fStatus as keyof Orcamento]) return false;
        if (busca) {
          const q = busca.toLowerCase();
          return (
            o.numero.toLowerCase().includes(q) ||
            o.empresa.toLowerCase().includes(q) ||
            o.cnpj.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.numero.localeCompare(a.numero));
  }, [orcamentos, busca, fEmpresa, fCnpj, fData, fStatus]);

  return (
    <div className="space-y-4">
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
          {(busca || fEmpresa || fCnpj || fData || fStatus) && (
            <Button
              variant="secondary"
              onClick={() => {
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
                  Nenhum orçamento encontrado.
                </td>
              </tr>
            ) : (
              filtrados.map((o) => (
                <tr
                  key={o.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                >
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {/* AQUI: Tornamos o número clicável */}
                    {onEdit ? (
                      <span 
                        onClick={() => onEdit(o)} 
                        className="cursor-pointer hover:underline text-blue-600 transition-colors"
                        title="Clique para editar este orçamento"
                      >
                        {o.numero}
                      </span>
                    ) : (
                      o.numero
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-500">
                    {formatDataBR(o.data)}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="truncate font-medium text-slate-900">
                      {o.empresa || "—"}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {o.cnpj || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-slate-900">
                    {formatBRL(totalFinal(o))}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {STATUS_FIELDS.map((s) => (
                        <StatusPill
                          key={s.key}
                          on={!!o[s.key as keyof Orcamento]}
                          label={s.label}
                          onClick={() =>
                            atualizar(o.id, { [s.key]: !o[s.key as keyof Orcamento] })
                          }
                          interactive
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <div className="inline-flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPreview(o)}
                        title="Visualizar orçamento"
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary"
                      >
                        <Eye size={16} />
                      </button>
                      {API_ENABLED && (
                        <button
                          onClick={() => handlePdf(o)}
                          disabled={pdfCarregando === o.id}
                          title="Baixar / abrir PDF do orçamento"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-primary-soft hover:text-primary disabled:opacity-50"
                        >
                          {pdfCarregando === o.id ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <FileDown size={16} />
                          )}
                        </button>
                      )}
                      {/* Ícone de OS — só aparece quando o orçamento está aprovado */}
                      {o.aprovado && onAbrirOs && (
                        <button
                          onClick={() => onAbrirOs(o.id)}
                          title="Abrir Ordem de Serviço"
                          className="inline-flex items-center justify-center rounded-md p-1.5 text-text-muted transition hover:bg-success-soft hover:text-success"
                        >
                          <FileText size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
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
                onClick={() => preview && handlePdf(preview)}
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
