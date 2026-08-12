import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Wallet, Upload, FileText } from "lucide-react";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, Block } from "../components/ui";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

// ===== Despesa (contas a pagar / pagas) =====
type Prioridade = "preto" | "vermelho" | "amarelo" | "verde";

interface Despesa {
  id: string;
  data: string;
  fornecedor: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  projeto: string | null;
  observacoes: string | null;
  prioridade: Prioridade | null;
  boletoNome: string | null;
  boletoEm: string | null;
}

// Cores da coluna Prioridade — só a cor é exibida, sem texto na célula.
// Ordem de importância (para ordenação): preto > vermelho > amarelo > verde > sem prioridade.
const PRIORIDADES: { valor: Prioridade; cor: string; label: string }[] = [
  { valor: "preto", cor: "#111827", label: "Urgente (preto)" },
  { valor: "vermelho", cor: "#ef4444", label: "Vermelho" },
  { valor: "amarelo", cor: "#f59e0b", label: "Amarelo" },
  { valor: "verde", cor: "#22c55e", label: "Verde" },
];
const ordemPrioridade: Record<string, number> = {
  preto: 0,
  vermelho: 1,
  amarelo: 2,
  verde: 3,
};
function corPrioridade(p: Prioridade | null): string {
  return PRIORIDADES.find((x) => x.valor === p)?.cor || "transparent";
}

// Categorias sugeridas (o usuário também pode digitar livremente).
const CATEGORIAS = [
  "Peças",
  "Impostos",
  "Salários",
  "Transporte",
  "Fornecedores",
  "Aluguel",
  "Serviços",
  "Marketing",
  "Outros",
];

// Estado inicial de uma despesa nova.
function despesaVazia(): Omit<Despesa, "id"> {
  return {
    data: hojeISO(),
    fornecedor: "",
    categoria: "",
    descricao: "",
    valor: 0,
    valorPago: 0,
    saldoDevedor: 0,
    pago: false,
    dataPagamento: null,
    projeto: "",
    observacoes: "",
    prioridade: null,
    boletoNome: null,
    boletoEm: null,
  };
}

export function Despesas() {
  const { user } = useAuth();
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");

  // Modal de criação/edição.
  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Despesa, "id">>(despesaVazia());
  const [salvando, setSalvando] = useState(false);

  // Modal de confirmação de exclusão.
  const [excluirId, setExcluirId] = useState<string | null>(null);

  // Upload de boleto — mesmo padrão do contrato assinado em Controle.
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const uploadDespesaId = useRef<string | null>(null);
  const [uploadCarregando, setUploadCarregando] = useState<string | null>(null);
  const [uploadErro, setUploadErro] = useState<string | null>(null);

  const iniciarUploadBoleto = (id: string) => {
    uploadDespesaId.current = id;
    uploadInputRef.current?.click();
  };

  const onArquivoSelecionado = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const arquivo = e.target.files?.[0];
    const id = uploadDespesaId.current;
    e.target.value = "";
    if (!arquivo || !id) return;

    setUploadErro(null);
    setUploadCarregando(id);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Falha ao ler o arquivo."));
        reader.readAsDataURL(arquivo);
      });
      const atualizada = await api.enviarBoletoDespesa(id, base64, arquivo.name);
      setDespesas((prev) =>
        prev.map((d) => (d.id === id ? (atualizada as Despesa) : d)),
      );
    } catch (err) {
      setUploadErro(
        err instanceof Error ? err.message : "Não foi possível enviar o boleto.",
      );
    } finally {
      setUploadCarregando(null);
      uploadDespesaId.current = null;
    }
  };

  const abrirBoleto = async (id: string) => {
    setUploadErro(null);
    try {
      await api.abrirBoletoDespesa(id);
    } catch (e) {
      setUploadErro(
        e instanceof Error ? e.message : "Não foi possível abrir o boleto.",
      );
    }
  };

  const alterarPrioridade = async (d: Despesa, prioridade: Prioridade | "") => {
    const valor = prioridade || null;
    setDespesas((prev) =>
      prev.map((x) => (x.id === d.id ? { ...x, prioridade: valor } : x)),
    );
    try {
      if (API_ENABLED) await api.atualizarDespesa(d.id, { prioridade: valor });
    } catch (e) {
      alert("Erro ao atualizar prioridade: " + (e as Error).message);
      carregar();
    }
  };

  const carregar = () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .listarDespesas("?pageSize=5000")
      .then((r) => setDespesas((r.data as Despesa[]) || []))
      .catch(() => setDespesas([]))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const base = !q
      ? despesas
      : despesas.filter((d) =>
          [d.fornecedor, d.categoria, d.descricao, d.projeto]
            .filter(Boolean)
            .some((v) => (v as string).toLowerCase().includes(q)),
        );

    // Ordem fixa: 1) cor de prioridade (preto > vermelho > amarelo > verde >
    // sem prioridade), 2) dentro da mesma cor, por data, 3) dentro da mesma
    // data, alfabética pelo fornecedor (beneficiário do pagamento).
    const arr = [...base];
    arr.sort((a, b) => {
      const pa = a.prioridade ? ordemPrioridade[a.prioridade] : 99;
      const pb = b.prioridade ? ordemPrioridade[b.prioridade] : 99;
      if (pa !== pb) return pa - pb;
      const cmpData = a.data.localeCompare(b.data);
      if (cmpData !== 0) return cmpData;
      return a.fornecedor.localeCompare(b.fornecedor, "pt-BR");
    });
    return arr;
  }, [despesas, busca]);

  const totais = useMemo(() => {
    const total = filtradas.reduce((s, d) => s + d.valor, 0);
    const pago = filtradas.filter((d) => d.pago).reduce((s, d) => s + d.valor, 0);
    return { total, pago, pendente: total - pago };
  }, [filtradas]);

  const abrirNova = () => {
    setEditId(null);
    setForm(despesaVazia());
    setModalAberto(true);
  };

  const abrirEdicao = (d: Despesa) => {
    setEditId(d.id);
    setForm({
      data: d.data,
      fornecedor: d.fornecedor,
      categoria: d.categoria || "",
      descricao: d.descricao || "",
      valor: d.valor,
      valorPago: d.valorPago,
      saldoDevedor: d.saldoDevedor,
      pago: d.pago,
      dataPagamento: d.dataPagamento,
      projeto: d.projeto || "",
      observacoes: d.observacoes || "",
      prioridade: d.prioridade,
      boletoNome: d.boletoNome,
      boletoEm: d.boletoEm,
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.fornecedor.trim()) {
      alert("Informe o fornecedor.");
      return;
    }
    setSalvando(true);
    const payload = {
      ...form,
      categoria: form.categoria || undefined,
      descricao: form.descricao || undefined,
      projeto: form.projeto || undefined,
      observacoes: form.observacoes || undefined,
      dataPagamento: form.dataPagamento || undefined,
      prioridade: form.prioridade || undefined,
    };
    try {
      if (editId) await api.atualizarDespesa(editId, payload);
      else await api.criarDespesa(payload);
      setModalAberto(false);
      carregar();
    } catch (e) {
      alert("Erro ao salvar a despesa: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluirId) return;
    try {
      await api.removerDespesa(excluirId);
      setExcluirId(null);
      carregar();
    } catch (e) {
      alert("Erro ao excluir: " + (e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Despesas</h1>
          <p className="text-sm text-text-muted">
            Contas a pagar e pagas — a base para o fluxo de caixa.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNova} icon={<Plus size={18} />}>
            Nova despesa
          </Button>
        )}
      </div>

      {/* Cartões de totais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Total
          </div>
          <div className="mt-1 text-xl font-semibold text-text">
            {formatBRL(totais.total)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Pago
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.pago)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            A pagar
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400">
            {formatBRL(totais.pendente)}
          </div>
        </div>
      </div>

      <Block title="Lançamentos" icon={<Wallet size={18} />}>
        <div className="mb-4 max-w-sm">
          <Input
            placeholder="Buscar por fornecedor, categoria, projeto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            icon={<Search size={16} />}
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2 text-center">Prioridade</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Fornecedor</th>
                <th className="px-2 py-2">Categoria</th>
                <th className="px-2 py-2">Projeto</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Valor pago</th>
                <th className="px-2 py-2 text-right">Saldo devedor</th>
                <th className="px-2 py-2 text-center">Situação</th>
                <th className="px-2 py-2 text-center">Boleto</th>
                {podeEditar && <th className="px-2 py-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 hover:bg-surface-offset/40"
                >
                  <td className="px-2 py-2">
                    <select
                      value={d.prioridade || ""}
                      onChange={(e) =>
                        alterarPrioridade(d, e.target.value as Prioridade | "")
                      }
                      disabled={!podeEditar}
                      title={
                        PRIORIDADES.find((p) => p.valor === d.prioridade)
                          ?.label || "Sem prioridade"
                      }
                      className="mx-auto block h-6 w-8 cursor-pointer rounded border border-border"
                      style={{ backgroundColor: corPrioridade(d.prioridade) }}
                    >
                      <option value="">Sem prioridade</option>
                      {PRIORIDADES.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {formatDataBR(d.data)}
                  </td>
                  <td className="px-2 py-2 font-medium text-text">
                    {d.fornecedor}
                    {d.descricao && (
                      <div className="text-xs text-text-muted">
                        {d.descricao}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2">{d.categoria || "—"}</td>
                  <td className="px-2 py-2">{d.projeto || "—"}</td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBRL(d.valor)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {d.valorPago ? formatBRL(d.valorPago) : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                    {formatBRL(d.saldoDevedor)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {d.pago ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Pago
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        A pagar
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-center">
                    {d.boletoNome ? (
                      <button
                        onClick={() => abrirBoleto(d.id)}
                        title={`Ver boleto (${d.boletoNome})`}
                        className="rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
                      >
                        <FileText size={16} />
                      </button>
                    ) : podeEditar ? (
                      <button
                        onClick={() => iniciarUploadBoleto(d.id)}
                        title="Anexar boleto"
                        disabled={uploadCarregando === d.id}
                        className="rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text disabled:opacity-50"
                      >
                        <Upload size={16} />
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  {podeEditar && (
                    <td className="whitespace-nowrap px-2 py-2 text-center">
                      <button
                        onClick={() => abrirEdicao(d)}
                        title="Editar"
                        className="mr-1 rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setExcluirId(d.id)}
                        title="Excluir"
                        className="rounded p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr>
                  <td
                    colSpan={podeEditar ? 10 : 9}
                    className="px-2 py-8 text-center text-text-muted"
                  >
                    {carregando
                      ? "Carregando..."
                      : "Nenhuma despesa cadastrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {uploadErro && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">
            {uploadErro}
          </p>
        )}
        {/* Input de arquivo oculto, compartilhado por todos os botões de upload de boleto. */}
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          ref={uploadInputRef}
          onChange={onArquivoSelecionado}
        />
      </Block>

      {/* Modal criar/editar */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editId ? "Editar despesa" : "Nova despesa"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Data"
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
            <Input
              label="Valor a pagar (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.valor || ""}
              onChange={(e) =>
                setForm({ ...form, valor: Number(e.target.value) || 0 })
              }
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Valor pago (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.valorPago || ""}
              onChange={(e) =>
                setForm({ ...form, valorPago: Number(e.target.value) || 0 })
              }
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">
                Saldo devedor (R$)
              </label>
              <div className="flex h-[38px] items-center rounded-md border border-border bg-surface-offset/40 px-3 text-sm text-text">
                {formatBRL(Math.max(0, (form.valor || 0) - (form.valorPago || 0)))}
              </div>
            </div>
            <Select
              label="Prioridade"
              value={form.prioridade || ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  prioridade: (e.target.value || null) as Prioridade | null,
                })
              }
            >
              <option value="">Sem prioridade</option>
              {PRIORIDADES.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Fornecedor"
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Categoria"
              value={form.categoria || ""}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            >
              <option value="">Selecione...</option>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Input
              label="Projeto / Centro de custo"
              value={form.projeto || ""}
              onChange={(e) => setForm({ ...form, projeto: e.target.value })}
            />
          </div>
          <Input
            label="Descrição"
            value={form.descricao || ""}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <div className="rounded-md border border-border p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.pago}
                onChange={(e) =>
                  setForm({
                    ...form,
                    pago: e.target.checked,
                    dataPagamento: e.target.checked
                      ? form.dataPagamento || hojeISO()
                      : null,
                  })
                }
              />
              <span className="font-medium text-text">Já foi paga</span>
            </label>
            {form.pago && (
              <div className="mt-3">
                <Input
                  label="Data do pagamento"
                  type="date"
                  value={form.dataPagamento || ""}
                  onChange={(e) =>
                    setForm({ ...form, dataPagamento: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <Textarea
            label="Observações"
            rows={2}
            value={form.observacoes || ""}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />
        </div>
      </Modal>

      {/* Modal confirmar exclusão */}
      <Modal
        open={!!excluirId}
        onClose={() => setExcluirId(null)}
        title="Excluir despesa"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setExcluirId(null)}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={confirmarExclusao}
              icon={<X size={16} />}
              className="!bg-red-600 !text-white hover:!bg-red-700"
            >
              Excluir
            </Button>
          </div>
        }
      >
        <p className="text-sm text-text">
          Tem certeza que deseja excluir esta despesa? Esta ação não pode ser
          desfeita.
        </p>
      </Modal>
    </div>
  );
}
