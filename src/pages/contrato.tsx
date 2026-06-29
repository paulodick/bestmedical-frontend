import { useEffect, useState } from "react";
import {
  Save,
  FileDown,
  Send,
  CheckCircle2,
  Loader2,
  X,
  FileSignature,
} from "lucide-react";
import { Block, Button, Textarea } from "../components/ui";
import type { Contrato } from "../types";
import { formatDataBR } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

interface ContratoPageProps {
  // O contrato é gerado/aberto a partir da proposta de origem.
  propostaId: string;
  onVoltar?: () => void;
}

export function ContratoPage({ propostaId, onVoltar }: ContratoPageProps) {
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pdfCarregando, setPdfCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<
    { tipo: "sucesso" | "erro"; texto: string } | null
  >(null);

  // Gera (idempotente) ou carrega o contrato da proposta ao montar.
  useEffect(() => {
    if (!API_ENABLED) {
      setErro(
        "API não configurada. Conecte o sistema à API para usar o Contrato.",
      );
      setCarregando(false);
      return;
    }
    setCarregando(true);
    api
      .gerarContratoDeProposta(propostaId)
      .then((dados) => {
        setContrato(dados as Contrato);
        setCarregando(false);
      })
      .catch((e) => {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o contrato.",
        );
        setCarregando(false);
      });
  }, [propostaId]);

  const setCorpo = (valor: string) =>
    setContrato((prev) =>
      prev ? { ...prev, conteudoCustomizado: valor } : prev,
    );

  const salvar = async () => {
    if (!contrato) return;
    setSalvando(true);
    setMensagem(null);
    try {
      const atualizado = await api.atualizarContrato(contrato.id, {
        conteudoCustomizado: contrato.conteudoCustomizado,
      });
      setContrato(atualizado as Contrato);
      setMensagem({ tipo: "sucesso", texto: "Contrato salvo com sucesso!" });
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao salvar o contrato.",
      });
    } finally {
      setSalvando(false);
    }
  };

  const abrirPdf = async () => {
    if (!contrato) return;
    setPdfCarregando(true);
    setMensagem(null);
    try {
      await api.abrirPdfContrato(contrato.id);
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao gerar o PDF.",
      });
    } finally {
      setPdfCarregando(false);
    }
  };

  const enviar = async () => {
    if (!contrato) return;
    setEnviando(true);
    setMensagem(null);
    try {
      const resp = await api.enviarContrato(contrato.id);
      setMensagem({ tipo: resp.ok ? "sucesso" : "erro", texto: resp.mensagem });
      if (resp.ok) {
        setContrato((prev) => (prev ? { ...prev, enviado: true } : prev));
      }
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao enviar o contrato.",
      });
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex min-h-[300px] items-center justify-center text-text-muted">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-danger/30 bg-danger/5 p-6 text-center">
          <p className="font-medium text-danger">{erro}</p>
        </div>
        {onVoltar && (
          <Button variant="secondary" onClick={onVoltar}>
            ← Voltar ao Controle
          </Button>
        )}
      </div>
    );
  }

  if (!contrato) return null;

  const customizado =
    contrato.conteudoCustomizado !== contrato.conteudoPadraoSnap;

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSignature size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-text">{contrato.numero}</h1>
            {contrato.enviado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                <CheckCircle2 size={11} />
                Enviado
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-text-faint">
            Data: {formatDataBR(contrato.data)}
          </p>
        </div>
        {onVoltar && (
          <Button variant="ghost" onClick={onVoltar}>
            ← Voltar
          </Button>
        )}
      </div>

      {/* Corpo editável do contrato */}
      <Block
        title="Corpo do Contrato"
        description="Edite as cláusulas livremente. Cada alteração é registrada no histórico da proposta (Observações Internas). Linhas em CAIXA ALTA viram títulos de cláusula; linhas iniciadas por “• ” viram itens."
        right={
          customizado ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Customizado
            </span>
          ) : undefined
        }
      >
        <Textarea
          value={contrato.conteudoCustomizado}
          onChange={(e) => setCorpo(e.target.value)}
          rows={28}
          className="font-mono text-[13px] leading-relaxed"
        />
      </Block>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <Button
          variant="secondary"
          icon={
            salvando ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )
          }
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        {API_ENABLED && (
          <>
            <Button
              variant="secondary"
              icon={
                pdfCarregando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <FileDown size={16} />
                )
              }
              onClick={abrirPdf}
              disabled={pdfCarregando}
            >
              {pdfCarregando ? "Gerando…" : "Baixar PDF"}
            </Button>
            <Button
              icon={
                enviando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )
              }
              onClick={enviar}
              disabled={enviando}
            >
              {enviando ? "Enviando…" : "Enviar ao cliente"}
            </Button>
          </>
        )}
      </div>

      {/* Toast */}
      {mensagem && (
        <div
          className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 animate-[fadeIn_.2s_ease] rounded-lg px-4 py-3 text-[13px] font-medium text-white shadow-lg ${
            mensagem.tipo === "sucesso" ? "bg-success" : "bg-slate-900"
          }`}
        >
          <span className="flex items-center gap-2">
            {mensagem.tipo === "sucesso" ? (
              <CheckCircle2 size={16} />
            ) : (
              <X size={16} className="text-rose-400" />
            )}
            {mensagem.texto}
            <button
              onClick={() => setMensagem(null)}
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
