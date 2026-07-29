import { useEffect, useState } from "react";
import { Input, Select, Button } from "./ui";
import { api, API_ENABLED } from "../lib/api";
import type { Solicitante } from "../lib/api";
import { maskTelefone } from "../lib/format";

interface SolicitanteSelectorProps {
  // id do cliente (só existe depois que o CNPJ foi resolvido ou o documento
  // já foi salvo ao menos uma vez). Sem clienteId, o dropdown não aparece —
  // o comportamento cai para os campos de texto livre de sempre.
  clienteId?: string | null;
  nome: string;
  setor: string;
  telefone: string;
  email: string;
  onChange: (patch: {
    solicitante?: string;
    setor?: string;
    telefone?: string;
    email?: string;
  }) => void;
}

const NOVO = "__novo__";

// Dropdown com os solicitantes já cadastrados para o cliente + opção "Novo
// Solicitante". Selecionar um nome preenche os campos abaixo; selecionar
// "Novo Solicitante" limpa os campos para cadastro e mostra o botão Salvar,
// que grava o novo contato no cliente (reaproveitado no próximo orçamento/
// proposta do mesmo cliente).
export function SolicitanteSelector({
  clienteId,
  nome,
  setor,
  telefone,
  email,
  onChange,
}: SolicitanteSelectorProps) {
  const [contatos, setContatos] = useState<Solicitante[]>([]);
  const [selecionado, setSelecionado] = useState<string>("");
  const [modoNovo, setModoNovo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setContatos([]);
    setSelecionado("");
    setModoNovo(false);
    if (!clienteId || !API_ENABLED) return;
    api
      .listarContatosCliente(clienteId)
      .then((lista) => setContatos(lista))
      .catch(() => setContatos([]));
  }, [clienteId]);

  const aplicarContato = (c: Solicitante) => {
    onChange({
      solicitante: c.nome,
      setor: c.setor || "",
      telefone: c.telefone || "",
      email: c.email || "",
    });
  };

  const handleSelecionar = (id: string) => {
    setErro(null);
    setSelecionado(id);
    if (id === NOVO) {
      setModoNovo(true);
      onChange({ solicitante: "", setor: "", telefone: "", email: "" });
      return;
    }
    setModoNovo(false);
    const c = contatos.find((x) => x.id === id);
    if (c) aplicarContato(c);
  };

  const handleSalvarNovo = async () => {
    if (!clienteId || !nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      const novo = await api.criarContatoCliente(clienteId, {
        nome: nome.trim(),
        setor: setor || undefined,
        telefone: telefone || undefined,
        email: email || undefined,
      });
      setContatos((prev) =>
        [...prev, novo].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      );
      setSelecionado(novo.id);
      setModoNovo(false);
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : "Não foi possível salvar o solicitante.",
      );
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-4">
      {clienteId && (
        <div className="flex flex-wrap items-end gap-3 rounded-md bg-surface-offset/60 p-3">
          <div className="min-w-[220px] flex-1">
            <Select
              label="Solicitante cadastrado"
              value={selecionado}
              onChange={(e) => handleSelecionar(e.target.value)}
            >
              <option value="">Selecione um solicitante já cadastrado…</option>
              {contatos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
              <option value={NOVO}>+ Novo Solicitante</option>
            </Select>
          </div>
          {modoNovo && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleSalvarNovo}
              disabled={salvando || !nome.trim()}
            >
              {salvando ? "Salvando…" : "Salvar solicitante"}
            </Button>
          )}
        </div>
      )}
      {erro && <p className="text-[12px] text-danger">{erro}</p>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Solicitante"
          value={nome}
          onChange={(e) => onChange({ solicitante: e.target.value })}
        />
        <Input
          label="Setor"
          value={setor}
          onChange={(e) => onChange({ setor: e.target.value })}
        />
        <Input
          label="Telefone"
          value={telefone}
          onChange={(e) => onChange({ telefone: maskTelefone(e.target.value) })}
          maxLength={15}
        />
        <Input
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => onChange({ email: e.target.value })}
        />
      </div>
    </div>
  );
}
