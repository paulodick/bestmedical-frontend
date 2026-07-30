import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, Plus, Send, X } from "lucide-react";
import { Modal } from "./Modal";
import { Button, Input } from "./ui";
import { api, API_ENABLED } from "../lib/api";
import type { Solicitante, EnvioComSolicitantes } from "../lib/api";

interface ModalEnviarSolicitantesProps {
  open: boolean;
  onClose: () => void;
  // id do cliente — usado para buscar os solicitantes cadastrados.
  clienteId?: string | null;
  empresa?: string;
  titulo: string;
  enviando: boolean;
  onEnviar: (envio: EnvioComSolicitantes) => void;
  // Valor inicial do campo "Referente à" (ex.: nome do primeiro item de
  // Itens e Serviços do orçamento). Fica editável antes do envio.
  referenciaPadrao?: string;
}

const artigoPadrao = (empresa?: string) => `À ${(empresa || "cliente").trim()}`;

interface FormContato {
  nome: string;
  setor: string;
  telefone: string;
  email: string;
}

const FORM_VAZIO: FormContato = { nome: "", setor: "", telefone: "", email: "" };

// Modal de envio com a lista de solicitantes cadastrados do cliente. Cada
// linha tem um checkbox para incluir no envio e outro para marcar quem é o
// "principal" (recebe em "Para"; os demais selecionados vão em cópia). Sem
// principal marcado, o e-mail sai com saudação genérica para a empresa. Uma
// cópia de confirmação (oculta) sempre vai para paulo@bestmedical.com.br.
// Também é possível, sem sair do modal, corrigir o e-mail/dados de um
// solicitante já cadastrado (lápis) e cadastrar um novo destinatário
// ("+ Novo destinatário").
export function ModalEnviarSolicitantes({
  open,
  onClose,
  clienteId,
  empresa,
  titulo,
  enviando,
  onEnviar,
  referenciaPadrao,
}: ModalEnviarSolicitantesProps) {
  const [contatos, setContatos] = useState<Solicitante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [principal, setPrincipal] = useState<string | null>(null);
  const [destinatario, setDestinatario] = useState("");
  const [referenteA, setReferenteA] = useState("");

  // Edição inline de um solicitante já cadastrado.
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<FormContato>(FORM_VAZIO);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState<string | null>(null);

  // Cadastro de um novo destinatário direto no modal.
  const [novoAberto, setNovoAberto] = useState(false);
  const [novo, setNovo] = useState<FormContato>(FORM_VAZIO);
  const [salvandoNovo, setSalvandoNovo] = useState(false);
  const [erroNovo, setErroNovo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set());
    setPrincipal(null);
    setDestinatario(artigoPadrao(empresa));
    setReferenteA(referenciaPadrao ? `à ${referenciaPadrao}` : "");
    setEditandoId(null);
    setErroEdicao(null);
    setNovoAberto(false);
    setNovo(FORM_VAZIO);
    setErroNovo(null);
    if (!clienteId || !API_ENABLED) {
      setContatos([]);
      return;
    }
    setCarregando(true);
    api
      .listarContatosCliente(clienteId)
      .then((lista) => {
        setContatos(lista);
        // Pré-seleciona, por conveniência, todos os contatos com e-mail.
        const comEmail = lista.filter((c) => (c.email || "").trim());
        setSelecionados(new Set(comEmail.map((c) => c.id)));
        if (comEmail.length === 1) setPrincipal(comEmail[0].id);
      })
      .catch(() => setContatos([]))
      .finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId]);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const novoSet = new Set(prev);
      if (novoSet.has(id)) {
        novoSet.delete(id);
        setPrincipal((p) => (p === id ? null : p));
      } else {
        novoSet.add(id);
      }
      return novoSet;
    });
  };

  const marcarPrincipal = (id: string) => {
    setPrincipal((prev) => (prev === id ? null : id));
    setSelecionados((prev) => new Set(prev).add(id));
  };

  const semSelecao = selecionados.size === 0;

  const handleEnviar = () => {
    onEnviar({
      contatoIds: [...selecionados],
      principalContatoId: principal,
      destinatario: destinatario.trim() || undefined,
      referenteA: referenteA.trim() || undefined,
    });
  };

  const iniciarEdicao = (c: Solicitante) => {
    setNovoAberto(false);
    setErroEdicao(null);
    setEditandoId(c.id);
    setEdicao({
      nome: c.nome || "",
      setor: c.setor || "",
      telefone: c.telefone || "",
      email: c.email || "",
    });
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setErroEdicao(null);
  };

  const salvarEdicao = async () => {
    if (!editandoId || !edicao.nome.trim()) return;
    setSalvandoEdicao(true);
    setErroEdicao(null);
    try {
      const atualizado = await api.atualizarContatoCliente(editandoId, {
        nome: edicao.nome.trim(),
        setor: edicao.setor.trim() || undefined,
        telefone: edicao.telefone.trim() || undefined,
        email: edicao.email.trim() || undefined,
      });
      setContatos((prev) =>
        prev.map((c) => (c.id === editandoId ? atualizado : c)),
      );
      setEditandoId(null);
    } catch (e) {
      setErroEdicao(
        e instanceof Error ? e.message : "Não foi possível salvar as alterações.",
      );
    } finally {
      setSalvandoEdicao(false);
    }
  };

  const abrirNovo = () => {
    cancelarEdicao();
    setErroNovo(null);
    setNovo(FORM_VAZIO);
    setNovoAberto(true);
  };

  const salvarNovo = async () => {
    if (!clienteId || !novo.nome.trim()) return;
    setSalvandoNovo(true);
    setErroNovo(null);
    try {
      const criado = await api.criarContatoCliente(clienteId, {
        nome: novo.nome.trim(),
        setor: novo.setor.trim() || undefined,
        telefone: novo.telefone.trim() || undefined,
        email: novo.email.trim() || undefined,
      });
      setContatos((prev) =>
        [...prev, criado].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      if ((criado.email || "").trim()) {
        setSelecionados((prev) => new Set(prev).add(criado.id));
      }
      setNovoAberto(false);
      setNovo(FORM_VAZIO);
    } catch (e) {
      setErroNovo(
        e instanceof Error ? e.message : "Não foi possível salvar o solicitante.",
      );
    } finally {
      setSalvandoNovo(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      wide
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={enviando}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleEnviar}
            disabled={enviando || semSelecao}
            icon={enviando ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          >
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <Input
          label="Destinatário"
          value={destinatario}
          onChange={(e) => setDestinatario(e.target.value)}
          placeholder="Ex.: À Clínica X — ou Ao Hospital Y"
        />
        <Input
          label="Referente"
          value={referenteA}
          onChange={(e) => setReferenteA(e.target.value)}
          placeholder="Ex.: à manutenção preventiva do equipamento X"
        />
        {!principal && !semSelecao && (
          <p className="rounded-md bg-surface-offset px-3 py-2 text-[12px] text-text-muted">
            Nenhum solicitante marcado como principal: o e-mail será aberto com a
            saudação genérica "Aos prezados representantes da{" "}
            {empresa || "empresa"}…".
          </p>
        )}
        <p className="text-[12px] text-text-faint">
          Uma cópia de confirmação (oculta) é sempre enviada para
          paulo@bestmedical.com.br.
        </p>
        {carregando ? (
          <div className="flex justify-center py-8 text-text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : (
          <>
            {contatos.length === 0 && (
              <p className="py-2 text-center text-[13px] text-text-faint">
                Nenhum solicitante cadastrado para este cliente ainda.
              </p>
            )}
            {contatos.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-divider text-left text-[12px] font-medium text-text-muted">
                      <th className="w-14 pb-2">Enviar</th>
                      <th className="w-20 pb-2 text-center">Principal</th>
                      <th className="pb-2">Nome</th>
                      <th className="pb-2">Setor</th>
                      <th className="pb-2">E-mail</th>
                      <th className="w-20 pb-2 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contatos.map((c) => {
                      const temEmail = !!(c.email || "").trim();
                      const emEdicao = editandoId === c.id;

                      if (emEdicao) {
                        return (
                          <tr key={c.id} className="border-b border-divider/50 last:border-0 bg-surface-offset/40">
                            <td className="py-2" colSpan={2} />
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                value={edicao.nome}
                                onChange={(e) =>
                                  setEdicao((f) => ({ ...f, nome: e.target.value }))
                                }
                                className="w-full rounded border border-divider bg-surface px-2 py-1 text-[13px]"
                                placeholder="Nome"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                value={edicao.setor}
                                onChange={(e) =>
                                  setEdicao((f) => ({ ...f, setor: e.target.value }))
                                }
                                className="w-full rounded border border-divider bg-surface px-2 py-1 text-[13px]"
                                placeholder="Setor"
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="email"
                                value={edicao.email}
                                onChange={(e) =>
                                  setEdicao((f) => ({ ...f, email: e.target.value }))
                                }
                                className="w-full rounded border border-divider bg-surface px-2 py-1 text-[13px]"
                                placeholder="E-mail"
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  onClick={salvarEdicao}
                                  disabled={salvandoEdicao || !edicao.nome.trim()}
                                  className="rounded p-1 text-success hover:bg-surface-offset disabled:opacity-50"
                                  title="Salvar"
                                >
                                  {salvandoEdicao ? (
                                    <Loader2 size={16} className="animate-spin" />
                                  ) : (
                                    <Check size={16} />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelarEdicao}
                                  disabled={salvandoEdicao}
                                  className="rounded p-1 text-text-muted hover:bg-surface-offset"
                                  title="Cancelar"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={c.id} className="border-b border-divider/50 last:border-0">
                          <td className="py-2">
                            <input
                              type="checkbox"
                              checked={selecionados.has(c.id)}
                              onChange={() => toggleSelecionado(c.id)}
                              disabled={!temEmail}
                              className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                              title={
                                temEmail
                                  ? "Selecionar para envio"
                                  : "Sem e-mail cadastrado"
                              }
                            />
                          </td>
                          <td className="py-2 text-center">
                            <input
                              type="checkbox"
                              checked={principal === c.id}
                              onChange={() => marcarPrincipal(c.id)}
                              disabled={!temEmail}
                              className="h-4 w-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                              title="Marcar como principal (recebe em 'Para'; demais em cópia)"
                            />
                          </td>
                          <td className="py-2 text-text">{c.nome}</td>
                          <td className="py-2 text-text-muted">{c.setor || "—"}</td>
                          <td
                            className={`py-2 ${
                              temEmail ? "text-text-muted" : "text-danger"
                            }`}
                          >
                            {c.email || "sem e-mail cadastrado"}
                          </td>
                          <td className="py-2 text-center">
                            <button
                              type="button"
                              onClick={() => iniciarEdicao(c)}
                              className="rounded p-1 text-text-muted hover:bg-surface-offset hover:text-text"
                              title="Editar solicitante"
                            >
                              <Pencil size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {erroEdicao && (
                  <p className="mt-2 text-[12px] text-danger">{erroEdicao}</p>
                )}
              </div>
            )}

            {clienteId && !novoAberto && (
              <button
                type="button"
                onClick={abrirNovo}
                className="flex items-center gap-1 text-[12px] font-medium text-primary hover:underline"
              >
                <Plus size={14} /> Novo destinatário
              </button>
            )}

            {clienteId && novoAberto && (
              <div className="space-y-3 rounded-md border border-divider bg-surface-offset/40 p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Nome"
                    value={novo.nome}
                    onChange={(e) => setNovo((f) => ({ ...f, nome: e.target.value }))}
                  />
                  <Input
                    label="Setor"
                    value={novo.setor}
                    onChange={(e) => setNovo((f) => ({ ...f, setor: e.target.value }))}
                  />
                  <Input
                    label="Telefone"
                    value={novo.telefone}
                    onChange={(e) => setNovo((f) => ({ ...f, telefone: e.target.value }))}
                  />
                  <Input
                    label="E-mail"
                    type="email"
                    value={novo.email}
                    onChange={(e) => setNovo((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                {erroNovo && <p className="text-[12px] text-danger">{erroNovo}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setNovoAberto(false)}
                    disabled={salvandoNovo}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={salvarNovo}
                    disabled={salvandoNovo || !novo.nome.trim()}
                  >
                    {salvandoNovo ? "Salvando…" : "Salvar destinatário"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
