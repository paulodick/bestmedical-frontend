import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "./Modal";
import { Button, Textarea } from "./ui";
import { api, API_ENABLED } from "../lib/api";
import { useAuth } from "../auth";
import type { FollowUp } from "../types";

// Formata uma data ISO (com hora) para dd/mm/aaaa.
function formatDataHora(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

interface FollowUpModalProps {
  open: boolean;
  onClose: () => void;
  // Identificação do registro: informar orcamentoId OU propostaId.
  orcamentoId?: string;
  propostaId?: string;
  // Número do registro (ex.: ORC-2026-0001) só para o título.
  numero: string;
}

export function FollowUpModal({
  open,
  onClose,
  orcamentoId,
  propostaId,
  numero,
}: FollowUpModalProps) {
  const { user } = useAuth();
  const [lista, setLista] = useState<FollowUp[]>([]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Data de hoje (dd/mm/aaaa) exibida no topo do formulário.
  const hoje = new Date().toLocaleDateString("pt-BR");
  const nomeAutor = (user?.nome || "").trim() || user?.email || "Usuário";

  // Carrega o histórico ao abrir.
  useEffect(() => {
    if (!open || !API_ENABLED) return;
    if (!orcamentoId && !propostaId) return;
    let ativo = true;
    setCarregando(true);
    setErro(null);
    api
      .listarFollowUps({ orcamentoId, propostaId })
      .then((r) => {
        if (ativo) setLista(r as FollowUp[]);
      })
      .catch((e) => {
        if (ativo)
          setErro(
            e instanceof Error ? e.message : "Falha ao carregar follow-ups.",
          );
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [open, orcamentoId, propostaId]);

  // Limpa o formulário ao fechar.
  useEffect(() => {
    if (!open) {
      setTexto("");
      setErro(null);
    }
  }, [open]);

  const salvar = async () => {
    const conteudo = texto.trim();
    if (!conteudo) return;
    if (!API_ENABLED) return;
    setSalvando(true);
    setErro(null);
    try {
      const novo = await api.criarFollowUp({
        orcamentoId,
        propostaId,
        texto: conteudo,
      });
      // Insere no topo (mais recente primeiro).
      setLista((prev) => [novo as FollowUp, ...prev]);
      setTexto("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar o follow-up.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Follow-up — ${numero}`}
      wide
      footer={
        <Button variant="ghost" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4 p-5">
        {/* Cabeçalho do novo follow-up: data de hoje + autor */}
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-md bg-primary-soft px-2.5 py-1 font-semibold text-primary">
            {hoje}
          </span>
          <span className="text-text-muted">por</span>
          <span className="font-medium text-text">{nomeAutor}</span>
        </div>

        {/* Caixa de texto + botão salvar */}
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Informações de follow-up do cliente..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              onClick={salvar}
              disabled={salvando || !texto.trim()}
              icon={
                salvando ? <Loader2 size={16} className="animate-spin" /> : undefined
              }
            >
              {salvando ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>

        {erro && (
          <div className="rounded-md bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {erro}
          </div>
        )}

        {/* Histórico de follow-ups (mais recente primeiro) */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-offset text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Data</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Nome</th>
                <th className="px-3 py-2 font-medium">
                  Informações sobre o Orçamento
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-text-muted">
                    <Loader2 size={18} className="mx-auto animate-spin" />
                  </td>
                </tr>
              ) : lista.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-text-muted">
                    Nenhum follow-up registrado ainda.
                  </td>
                </tr>
              ) : (
                lista.map((f) => (
                  <tr
                    key={f.id}
                    className="border-b border-divider align-top last:border-0"
                  >
                    <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                      {formatDataHora(f.createdAt)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-text">
                      {f.autorNome}
                    </td>
                    <td className="px-3 py-2 whitespace-pre-wrap text-text">
                      {f.texto}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
