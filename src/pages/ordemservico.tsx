import { useCallback, useEffect, useRef, useState } from "react";
import {
  Save,
  FileDown,
  Send,
  CheckCircle2,
  Loader2,
  X,
  Plus,
  Trash2,
  ImagePlus,
  FileText,
} from "lucide-react";
import { Block, Button, Field, Input, Textarea } from "../components/ui";
import { Modal } from "../components/Modal";
import type { OrdemServico, ItemOS, FotoOS } from "../types";
import { formatDataBR } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

// ===== Utilitários =====

// Comprime e redimensiona uma imagem para economizar payload
// Max 1000px no lado maior, jpeg qualidade 0.7
async function comprimirImagem(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1000;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width);
            width = MAX;
          } else {
            width = Math.round((width * MAX) / height);
            height = MAX;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===== Canvas de Assinatura =====
interface CanvasAssinaturaProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

function CanvasAssinatura({ label, value, onChange }: CanvasAssinaturaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const ultimoPonto = useRef<{ x: number; y: number } | null>(null);

  // Carrega imagem existente ao montar ou quando value muda externamente
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };
      img.src = value;
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / rect.width;
    const scaleY = canvasRef.current!.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const iniciarDesenho = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    desenhando.current = true;
    ultimoPonto.current = getPos(e);
    // Captura o ponteiro para receber eventos fora do canvas (touch)
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  };

  const desenhar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current || !ultimoPonto.current) return;
    e.preventDefault();
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(ultimoPonto.current.x, ultimoPonto.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    ultimoPonto.current = pos;
  };

  const pararDesenho = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!desenhando.current) return;
    e.preventDefault();
    desenhando.current = false;
    ultimoPonto.current = null;
    // Salva como dataURL PNG
    const canvas = canvasRef.current!;
    onChange(canvas.toDataURL("image/png"));
  };

  const limpar = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-text-muted">{label}</span>
        <button
          type="button"
          onClick={limpar}
          className="text-[12px] text-text-faint hover:text-danger transition"
        >
          Limpar
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={400}
        height={150}
        onPointerDown={iniciarDesenho}
        onPointerMove={desenhar}
        onPointerUp={pararDesenho}
        onPointerCancel={pararDesenho}
        style={{ touchAction: "none" }}
        className="w-full rounded-md border border-border bg-white cursor-crosshair"
      />
      {!value && (
        <p className="text-[11px] text-text-faint">
          Assine acima com o dedo ou mouse
        </p>
      )}
    </div>
  );
}

// ===== Modal de envio por e-mail =====
interface ModalEnviarProps {
  open: boolean;
  onClose: () => void;
  emailPadrao: string;
  onEnviar: (emails: string[]) => void;
  enviando: boolean;
}

function ModalEnviar({ open, onClose, emailPadrao, onEnviar, enviando }: ModalEnviarProps) {
  const [emails, setEmails] = useState<string[]>([emailPadrao || ""]);

  // Reseta quando abre
  useEffect(() => {
    if (open) setEmails([emailPadrao || ""]);
  }, [open, emailPadrao]);

  const adicionarEmail = () => setEmails((prev) => [...prev, ""]);
  const removerEmail = (i: number) => setEmails((prev) => prev.filter((_, idx) => idx !== i));
  const alterarEmail = (i: number, val: string) =>
    setEmails((prev) => prev.map((e, idx) => (idx === i ? val : e)));

  const emailsValidos = emails.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim()));

  const handleEnviar = () => {
    if (emailsValidos.length === 0) return;
    onEnviar(emailsValidos);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Enviar Ordem de Serviço"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnviar}
            disabled={enviando || emailsValidos.length === 0}
            icon={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          >
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-[13px] text-text-muted">
          A OS será enviada em PDF como anexo. Uma cópia sempre vai para{" "}
          <strong>paulo@bestmedical.com.br</strong>.
        </p>
        <div className="space-y-2">
          {emails.map((email, i) => (
            <div key={i} className="flex gap-2">
              <Input
                type="email"
                placeholder="email@exemplo.com"
                value={email}
                onChange={(e) => alterarEmail(i, e.target.value)}
                className="flex-1"
              />
              {emails.length > 1 && (
                <button
                  type="button"
                  onClick={() => removerEmail(i)}
                  className="rounded-md p-2 text-text-muted hover:bg-surface-offset hover:text-danger transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={adicionarEmail}
          className="inline-flex items-center gap-1.5 text-[13px] text-primary hover:underline"
        >
          <Plus size={14} />
          Adicionar e-mail
        </button>
        {emailsValidos.length === 0 && emails.some((e) => e.trim()) && (
          <p className="text-[12px] text-danger">
            Informe pelo menos um e-mail válido.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ===== Página principal Ordem de Serviço =====
interface OrdemServicoPageProps {
  orcamentoId: string;
  onVoltar?: () => void;
}

export function OrdemServicoPage({ orcamentoId, onVoltar }: OrdemServicoPageProps) {
  const [os, setOs] = useState<OrdemServico | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: "sucesso" | "erro"; texto: string } | null>(null);
  const [modalEnviarAberto, setModalEnviarAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [pdfCarregando, setPdfCarregando] = useState(false);
  const inputFotoRef = useRef<HTMLInputElement>(null);

  // Carrega a OS do servidor
  useEffect(() => {
    if (!API_ENABLED) {
      setErro("API não configurada. Conecte o sistema à API para usar a Ordem de Serviço.");
      setCarregando(false);
      return;
    }
    setCarregando(true);
    api
      .buscarOsPorOrcamento(orcamentoId)
      .then((dados) => {
        setOs(dados as OrdemServico);
        setCarregando(false);
      })
      .catch((e) => {
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar a Ordem de Serviço."
        );
        setCarregando(false);
      });
  }, [orcamentoId]);

  // Atualiza um campo simples da OS
  const setField = useCallback(<K extends keyof OrdemServico>(campo: K, valor: OrdemServico[K]) => {
    setOs((prev) => (prev ? { ...prev, [campo]: valor } : prev));
  }, []);

  // Atualiza um item (realizado ou detalhes)
  const setItem = (idx: number, patch: Partial<ItemOS>) => {
    setOs((prev) => {
      if (!prev) return prev;
      const itens = prev.itens.map((it, i) => (i === idx ? { ...it, ...patch } : it));
      return { ...prev, itens };
    });
  };

  // Adiciona fotos (comprime antes)
  const adicionarFotos = async (files: FileList) => {
    if (!os) return;
    const restante = 10 - os.fotos.length;
    if (restante <= 0) {
      setMensagem({ tipo: "erro", texto: "Limite de 10 fotos atingido." });
      return;
    }
    const filesToAdd = Array.from(files).slice(0, restante);
    const novasFotos: FotoOS[] = await Promise.all(
      filesToAdd.map(async (f) => ({
        dataUrl: await comprimirImagem(f),
        legenda: "",
      }))
    );
    setOs((prev) => {
      if (!prev) return prev;
      return { ...prev, fotos: [...prev.fotos, ...novasFotos] };
    });
  };

  const removerFoto = (idx: number) => {
    setOs((prev) => {
      if (!prev) return prev;
      return { ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) };
    });
  };

  const setLegendaFoto = (idx: number, legenda: string) => {
    setOs((prev) => {
      if (!prev) return prev;
      const fotos = prev.fotos.map((f, i) => (i === idx ? { ...f, legenda } : f));
      return { ...prev, fotos };
    });
  };

  // Salva a OS no servidor
  const salvar = async () => {
    if (!os) return;
    setSalvando(true);
    setMensagem(null);
    try {
      const payload = {
        descricaoServico: os.descricaoServico,
        observacoes: os.observacoes,
        assinaturaCliente: os.assinaturaCliente,
        assinaturaTecnico: os.assinaturaTecnico,
        itens: os.itens.map((it) => ({
          codigo: it.codigo,
          descricao: it.item,
          quantidade: it.quantidade,
          realizado: it.realizado,
          detalhes: it.detalhes,
        })),
        fotos: os.fotos.map((f) => ({
          dataUrl: f.dataUrl,
          legenda: f.legenda,
        })),
      };
      const atualizada = await api.atualizarOs(os.id, payload);
      setOs(atualizada as OrdemServico);
      setMensagem({ tipo: "sucesso", texto: "Ordem de Serviço salva com sucesso!" });
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao salvar a OS.",
      });
    } finally {
      setSalvando(false);
    }
  };

  // Abre PDF da OS
  const abrirPdf = async () => {
    if (!os) return;
    setPdfCarregando(true);
    setMensagem(null);
    try {
      await api.abrirPdfOs(os.id);
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao gerar o PDF.",
      });
    } finally {
      setPdfCarregando(false);
    }
  };

  // Envia a OS por e-mail
  const enviar = async (destinatarios: string[]) => {
    if (!os) return;
    setEnviando(true);
    setMensagem(null);
    try {
      const resp = await api.enviarOs(os.id, destinatarios);
      setModalEnviarAberto(false);
      setMensagem({
        tipo: resp.ok ? "sucesso" : "erro",
        texto: resp.mensagem,
      });
      if (resp.ok) {
        setOs((prev) => (prev ? { ...prev, enviado: true } : prev));
      }
    } catch (e) {
      setMensagem({
        tipo: "erro",
        texto: e instanceof Error ? e.message : "Erro ao enviar a OS.",
      });
    } finally {
      setEnviando(false);
    }
  };

  // ===== Renderização =====

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
          <p className="text-danger font-medium">{erro}</p>
        </div>
        {onVoltar && (
          <Button variant="secondary" onClick={onVoltar}>
            ← Voltar ao Controle
          </Button>
        )}
      </div>
    );
  }

  if (!os) return null;

  const marcaExibida =
    os.marca === "Outras" ? os.marcaOutras || "Outras" : os.marca;

  return (
    <div className="space-y-5">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileText size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-text">{os.numero}</h1>
            {os.enviado && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                <CheckCircle2 size={11} />
                Enviada
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-text-faint">
            Data: {formatDataBR(os.data)}
          </p>
        </div>
        {onVoltar && (
          <Button variant="ghost" onClick={onVoltar}>
            ← Voltar
          </Button>
        )}
      </div>

      {/* Bloco 1 — Cliente */}
      <Block title="Cliente" step={1}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Empresa / Razão Social">
            <Input value={os.empresa} disabled readOnly />
          </Field>
          <Field label="CNPJ">
            <Input value={os.cnpj} disabled readOnly />
          </Field>
          <Field label="Endereço">
            <Input value={[os.endereco, os.enderecoNumero].filter(Boolean).join(", ")} disabled readOnly />
          </Field>
          <Field label="Bairro / Cidade / Estado">
            <Input
              value={[os.bairro, os.cidade, os.estado].filter(Boolean).join(" / ")}
              disabled
              readOnly
            />
          </Field>
        </div>
      </Block>

      {/* Bloco 2 — Solicitante */}
      <Block title="Solicitante" step={2}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input value={os.solicitante} disabled readOnly />
          </Field>
          <Field label="Setor">
            <Input value={os.setor} disabled readOnly />
          </Field>
          <Field label="Telefone">
            <Input value={os.telefone} disabled readOnly />
          </Field>
          <Field label="E-mail">
            <Input value={os.email} disabled readOnly />
          </Field>
        </div>
      </Block>

      {/* Bloco 3 — Dados do Equipamento */}
      <Block title="Dados do Equipamento" step={3}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Modalidade">
            <Input value={os.modalidade} disabled readOnly />
          </Field>
          <Field label="Marca">
            <Input value={marcaExibida} disabled readOnly />
          </Field>
          <Field label="Modelo">
            <Input value={os.modelo} disabled readOnly />
          </Field>
          <Field label="Número de Série">
            <Input value={os.numeroSerie} disabled readOnly />
          </Field>
        </div>
        {os.descricaoVisita && (
          <div className="mt-4">
            <Field label="Descrição da Visita Técnica">
              <Textarea value={os.descricaoVisita} disabled readOnly rows={3} />
            </Field>
          </div>
        )}
      </Block>

      {/* Bloco 4 — Itens a executar */}
      <Block title="Itens a Executar" step={4} description="Marque os itens realizados e adicione detalhes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-divider text-left text-[12px] font-medium text-text-muted">
                <th className="pb-2 pr-3">Código</th>
                <th className="pb-2 pr-3">Item</th>
                <th className="pb-2 pr-3 text-center">Qtd.</th>
                <th className="pb-2 pr-3 text-center">Realizado</th>
                <th className="pb-2">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {os.itens.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-text-faint">
                    Nenhum item cadastrado.
                  </td>
                </tr>
              ) : (
                os.itens.map((it, idx) => (
                  <tr key={it.id ?? idx} className="border-b border-divider/50 last:border-0">
                    <td className="py-2 pr-3 text-text-muted">{it.codigo || "—"}</td>
                    <td className="py-2 pr-3 text-text">{it.item || "—"}</td>
                    <td className="py-2 pr-3 text-center text-text-muted">{it.quantidade}</td>
                    <td className="py-2 pr-3 text-center">
                      <input
                        type="checkbox"
                        checked={it.realizado}
                        onChange={(e) => setItem(idx, { realizado: e.target.checked })}
                        className="h-4 w-4 cursor-pointer accent-primary"
                        title="Marcar como realizado"
                      />
                    </td>
                    <td className="py-2">
                      <input
                        type="text"
                        value={it.detalhes}
                        onChange={(e) => setItem(idx, { detalhes: e.target.value })}
                        placeholder="Detalhes do item…"
                        className="w-full rounded-md border border-border bg-surface px-2 py-1 text-[13px] text-text placeholder:text-text-faint focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Block>

      {/* Bloco 5 — Descrição do Serviço */}
      <Block title="Descrição do Serviço" step={5}>
        <Textarea
          value={os.descricaoServico}
          onChange={(e) => setField("descricaoServico", e.target.value)}
          placeholder="Descreva detalhadamente o serviço realizado…"
          rows={5}
        />
      </Block>

      {/* Bloco 6 — Fotos */}
      <Block
        title="Fotos"
        step={6}
        description={`${os.fotos.length}/10 fotos adicionadas`}
      >
        <div className="space-y-4">
          {/* Grade de fotos */}
          {os.fotos.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {os.fotos.map((foto, idx) => (
                <div key={idx} className="group relative rounded-lg border border-border overflow-hidden bg-surface-offset">
                  <img
                    src={foto.dataUrl}
                    alt={foto.legenda || `Foto ${idx + 1}`}
                    className="h-40 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removerFoto(idx)}
                    className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1 text-white opacity-0 transition hover:bg-black/80 group-hover:opacity-100"
                    title="Remover foto"
                  >
                    <Trash2 size={14} />
                  </button>
                  <div className="p-2">
                    <input
                      type="text"
                      value={foto.legenda}
                      onChange={(e) => setLegendaFoto(idx, e.target.value)}
                      placeholder="Legenda…"
                      className="w-full rounded border border-border bg-surface px-2 py-1 text-[12px] text-text placeholder:text-text-faint focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Botão adicionar */}
          {os.fotos.length < 10 && (
            <>
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && adicionarFotos(e.target.files)}
              />
              <Button
                variant="secondary"
                icon={<ImagePlus size={16} />}
                onClick={() => inputFotoRef.current?.click()}
              >
                Adicionar foto{os.fotos.length > 0 ? "s" : ""}
              </Button>
            </>
          )}
          {os.fotos.length >= 10 && (
            <p className="text-[12px] text-text-faint">
              Limite máximo de 10 fotos atingido.
            </p>
          )}
        </div>
      </Block>

      {/* Bloco 7 — Observações */}
      <Block title="Observações" step={7}>
        <Textarea
          value={os.observacoes}
          onChange={(e) => setField("observacoes", e.target.value)}
          placeholder="Observações adicionais sobre a ordem de serviço…"
          rows={3}
        />
      </Block>

      {/* Bloco 8 — Assinaturas */}
      <Block title="Assinaturas" step={8} description="Assine com o dedo ou mouse">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CanvasAssinatura
            label="Assinatura do Cliente"
            value={os.assinaturaCliente}
            onChange={(v) => setField("assinaturaCliente", v)}
          />
          <CanvasAssinatura
            label="Assinatura do Técnico"
            value={os.assinaturaTecnico}
            onChange={(v) => setField("assinaturaTecnico", v)}
          />
        </div>
      </Block>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border border-border bg-surface px-5 py-4 shadow-sm">
        <Button
          variant="secondary"
          icon={salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          onClick={salvar}
          disabled={salvando}
        >
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        {API_ENABLED && (
          <>
            <Button
              variant="secondary"
              icon={pdfCarregando ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
              onClick={abrirPdf}
              disabled={pdfCarregando}
            >
              {pdfCarregando ? "Gerando…" : "Exportar PDF"}
            </Button>
            <Button
              icon={<Send size={16} />}
              onClick={() => setModalEnviarAberto(true)}
            >
              Enviar para o cliente
            </Button>
          </>
        )}
      </div>

      {/* Toast de feedback */}
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

      {/* Modal de envio */}
      <ModalEnviar
        open={modalEnviarAberto}
        onClose={() => setModalEnviarAberto(false)}
        emailPadrao={os.email}
        onEnviar={enviar}
        enviando={enviando}
      />
    </div>
  );
}
