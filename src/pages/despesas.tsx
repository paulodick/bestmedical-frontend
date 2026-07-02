import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Wallet } from "lucide-react";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, Block } from "../components/ui";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

// ===== Despesa (contas a pagar / pagas) =====
interface Despesa {
  id: string;
  data: string;
  fornecedor: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  projeto: string | null;
  observacoes: string | null;
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
    pago: false,
    dataPagamento: null,
    projeto: "",
    observacoes: "",
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
    if (!q) return despesas;
    return despesas.filter((d) =>
      [d.fornecedor, d.categoria, d.descricao, d.projeto]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
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
      pago: d.pago,
      dataPagamento: d.dataPagamento,
      projeto: d.projeto || "",
      observacoes: d.observacoes || "",
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
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Fornecedor</th>
                <th className="px-2 py-2">Categoria</th>
                <th className="px-2 py-2">Projeto</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-center">Situação</th>
                {podeEditar && <th className="px-2 py-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => (
                <tr
                  key={d.id}
                  className="border-b border-border/60 hover:bg-surface-offset/40"
                >
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
                    colSpan={podeEditar ? 7 : 6}
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
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.valor || ""}
              onChange={(e) =>
                setForm({ ...form, valor: Number(e.target.value) || 0 })
              }
            />
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
