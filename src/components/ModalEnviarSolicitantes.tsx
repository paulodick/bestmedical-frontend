import { useEffect, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { Modal } from "./Modal";
import { Button } from "./ui";
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
}

// Modal de envio com a lista de solicitantes cadastrados do cliente. Cada
// linha tem um checkbox para incluir no envio e outro para marcar quem é o
// "principal" (recebe em "Para"; os demais selecionados vão em cópia). Sem
// principal marcado, o e-mail sai com saudação genérica para a empresa. Uma
// cópia de confirmação (oculta) sempre vai para paulo@bestmedical.com.br.
export function ModalEnviarSolicitantes({
  open,
  onClose,
  clienteId,
  empresa,
  titulo,
  enviando,
  onEnviar,
}: ModalEnviarSolicitantesProps) {
  const [contatos, setContatos] = useState<Solicitante[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [principal, setPrincipal] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelecionados(new Set());
    setPrincipal(null);
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
  }, [open, clienteId]);

  const toggleSelecionado = (id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) {
        novo.delete(id);
        setPrincipal((p) => (p === id ? null : p));
      } else {
        novo.add(id);
      }
      return novo;
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
    });
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
        ) : contatos.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-text-faint">
            Nenhum solicitante cadastrado para este cliente ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-divider text-left text-[12px] font-medium text-text-muted">
                  <th className="w-14 pb-2">Enviar</th>
                  <th className="w-20 pb-2 text-center">Principal</th>
                  <th className="pb-2">Nome</th>
                  <th className="pb-2">Setor</th>
                  <th className="pb-2">E-mail</th>
                </tr>
              </thead>
              <tbody>
                {contatos.map((c) => {
                  const temEmail = !!(c.email || "").trim();
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
