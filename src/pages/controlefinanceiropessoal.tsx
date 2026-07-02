import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  X,
  Wallet,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, Block } from "../components/ui";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import { api, API_ENABLED } from "../lib/api";

// ===== Lançamento financeiro pessoal (receita | despesa) =====
// Tabela totalmente separada da empresa. Os lançamentos são livres, com os
// mesmos campos do controle financeiro: a coluna "Empresa" vira "Empresa /
// Pessoa" e o campo "Número" vira um dropdown de pessoa (Paulo / Luisa).
interface Lancamento {
  id: string;
  data: string;
  tipo: string; // 'receita' | 'despesa'
  pessoa: string; // 'Paulo' | 'Luisa'
  categoria: string | null;
  descricao: string | null;
  valor: number;
  pago: boolean;
  dataPagamento: string | null;
  observacoes: string | null;
}

// Pessoas disponíveis no dropdown (substitui o antigo campo "Número").
const PESSOAS = ["Paulo", "Luisa"];

// Categorias sugeridas (o usuário também pode digitar livremente).
const CATEGORIAS = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Investimentos",
  "Impostos",
  "Salário",
  "Outros",
];

// Estado inicial de um lançamento novo.
function lancamentoVazio(): Omit<Lancamento, "id"> {
  return {
    data: hojeISO(),
    tipo: "despesa",
    pessoa: "Paulo",
    categoria: "",
    descricao: "",
    valor: 0,
    pago: false,
    dataPagamento: null,
    observacoes: "",
  };
}

export function ControleFinanceiroPessoal() {
  const { user } = useAuth();
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [fPessoa, setFPessoa] = useState("");
  const [fTipo, setFTipo] = useState("");

  // Modal de criação/edição.
  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Lancamento, "id">>(lancamentoVazio());
  const [salvando, setSalvando] = useState(false);

  // Modal de confirmação de exclusão.
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const carregar = () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .listarPessoal("?pageSize=5000")
      .then((r) => setLancamentos((r.data as Lancamento[]) || []))
      .catch(() => setLancamentos([]))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return lancamentos.filter((l) => {
      if (fPessoa && l.pessoa !== fPessoa) return false;
      if (fTipo && l.tipo !== fTipo) return false;
      if (!q) return true;
      return [l.pessoa, l.categoria, l.descricao]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [lancamentos, busca, fPessoa, fTipo]);

  const totais = useMemo(() => {
    const receitas = filtrados
      .filter((l) => l.tipo === "receita")
      .reduce((s, l) => s + l.valor, 0);
    const despesas = filtrados
      .filter((l) => l.tipo === "despesa")
      .reduce((s, l) => s + l.valor, 0);
    return { receitas, despesas, saldo: receitas - despesas };
  }, [filtrados]);

  const abrirNovo = () => {
    setEditId(null);
    setForm(lancamentoVazio());
    setModalAberto(true);
  };

  const abrirEdicao = (l: Lancamento) => {
    setEditId(l.id);
    setForm({
      data: l.data,
      tipo: l.tipo,
      pessoa: l.pessoa,
      categoria: l.categoria || "",
      descricao: l.descricao || "",
      valor: l.valor,
      pago: l.pago,
      dataPagamento: l.dataPagamento,
      observacoes: l.observacoes || "",
    });
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.pessoa.trim()) {
      alert("Selecione a pessoa (Paulo ou Luisa).");
      return;
    }
    setSalvando(true);
    const payload = {
      ...form,
      categoria: form.categoria || undefined,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      dataPagamento: form.dataPagamento || undefined,
    };
    try {
      if (editId) await api.atualizarPessoal(editId, payload);
      else await api.criarPessoal(payload);
      setModalAberto(false);
      carregar();
    } catch (e) {
      alert("Erro ao salvar o lançamento: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluirId) return;
    try {
      await api.removerPessoal(excluirId);
      setExcluirId(null);
      carregar();
    } catch (e) {
      alert("Erro ao excluir: " + (e as Error).message);
    }
  };

  // Registrar pagamento/recebimento: marca como pago com a data de hoje.
  const registrarPagamento = async (l: Lancamento) => {
    // Atualização otimista para resposta imediata.
    setLancamentos((prev) =>
      prev.map((x) =>
        x.id === l.id
          ? { ...x, pago: true, dataPagamento: x.dataPagamento || hojeISO() }
          : x,
      ),
    );
    try {
      await api.atualizarPessoal(l.id, {
        pago: true,
        dataPagamento: l.dataPagamento || hojeISO(),
      });
    } catch (e) {
      alert("Erro ao registrar pagamento: " + (e as Error).message);
      carregar();
    }
  };

  const temFiltro = !!(busca || fPessoa || fTipo);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">
            Controle Financeiro Pessoal
          </h1>
          <p className="text-sm text-text-muted">
            Receitas e despesas pessoais (Paulo / Luisa) — separado da empresa.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNovo} icon={<Plus size={18} />}>
            Novo lançamento
          </Button>
        )}
      </div>

      {/* Cartões de totais */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Receitas
          </div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.receitas)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Despesas
          </div>
          <div className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">
            {formatBRL(totais.despesas)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">
            Saldo
          </div>
          <div
            className={`mt-1 text-xl font-semibold ${
              totais.saldo >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {formatBRL(totais.saldo)}
          </div>
        </div>
      </div>

      <Block title="Lançamentos" icon={<Wallet size={18} />}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="max-w-sm flex-1">
            <Input
              placeholder="Buscar por pessoa, categoria, descrição..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select value={fPessoa} onChange={(e) => setFPessoa(e.target.value)}>
            <option value="">Todas as pessoas</option>
            {PESSOAS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
          <Select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </Select>
          {temFiltro && (
            <Button
              variant="secondary"
              onClick={() => {
                setBusca("");
                setFPessoa("");
                setFTipo("");
              }}
              title="Limpar filtros"
              className="px-2"
            >
              <X size={16} />
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2">Origem</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Tipo</th>
                <th className="px-2 py-2">Empresa / Pessoa</th>
                <th className="px-2 py-2">Categoria</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-center">Situação</th>
                {podeEditar && <th className="px-2 py-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((l) => (
                <tr
                  key={l.id}
                  className="border-b border-border/60 hover:bg-surface-offset/40"
                >
                  {/* Pessoa (Paulo/Luisa) — dropdown no cadastro, coluna à esquerda da Data */}
                  <td className="whitespace-nowrap px-2 py-2 font-medium text-text">
                    {l.pessoa}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2">
                    {formatDataBR(l.data)}
                  </td>
                  <td className="px-2 py-2">
                    {l.tipo === "receita" ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        Receita
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                        Despesa
                      </span>
                    )}
                  </td>
                  {/* Empresa / Pessoa = credor ou devedor (texto livre) */}
                  <td className="px-2 py-2 font-medium text-text">
                    {l.descricao || "\u2014"}
                  </td>
                  <td className="px-2 py-2">{l.categoria || "\u2014"}</td>
                  <td
                    className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${
                      l.tipo === "receita"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatBRL(l.valor)}
                  </td>
                  <td className="px-2 py-2 text-center">
                    {l.pago ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {l.tipo === "receita" ? "Recebido" : "Pago"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                        {l.tipo === "receita" ? "A receber" : "A pagar"}
                      </span>
                    )}
                  </td>
                  {podeEditar && (
                    <td className="whitespace-nowrap px-2 py-2 text-center">
                      {!l.pago && (
                        <button
                          onClick={() => registrarPagamento(l)}
                          title={
                            l.tipo === "receita"
                              ? "Registrar recebimento"
                              : "Registrar pagamento"
                          }
                          className="mr-1 rounded p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                      <button
                        onClick={() => abrirEdicao(l)}
                        title="Editar"
                        className="mr-1 rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        onClick={() => setExcluirId(l.id)}
                        title="Excluir"
                        className="rounded p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={podeEditar ? 8 : 7}
                    className="px-2 py-8 text-center text-text-muted"
                  >
                    {carregando
                      ? "Carregando..."
                      : "Nenhum lançamento cadastrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      {/* Modal criar/editar lançamento */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editId ? "Editar lançamento" : "Novo lançamento"}
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
            <Select
              label="Tipo"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
            >
              <option value="despesa">Despesa</option>
              <option value="receita">Receita</option>
            </Select>
            <Select
              label="Origem"
              value={form.pessoa}
              onChange={(e) => setForm({ ...form, pessoa: e.target.value })}
            >
              {PESSOAS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
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
            label="Empresa / Pessoa (credor ou devedor)"
            placeholder="Nome de quem recebe ou paga"
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
              <span className="font-medium text-text">
                {form.tipo === "receita" ? "Já foi recebido" : "Já foi pago"}
              </span>
            </label>
            {form.pago && (
              <div className="mt-3">
                <Input
                  label={
                    form.tipo === "receita"
                      ? "Data do recebimento"
                      : "Data do pagamento"
                  }
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
        title="Excluir lançamento"
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
          Tem certeza que deseja excluir este lançamento pessoal? Esta ação não
          pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
