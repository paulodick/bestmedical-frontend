import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Wallet } from "lucide-react";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, Block } from "../components/ui";
import { PainelBaixas } from "../components/PainelBaixas";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import { api, API_ENABLED, type Baixa, type NovaBaixa } from "../lib/api";

// ===== Despesa do Controle Financeiro Pessoal =====
// Mesmo conceito de Despesas (empresa), com baixa parcial (histórico) — só
// que separada por pessoa, em tabela própria (schema "pessoal").
const PESSOAS = ["Paulo", "Luisa"];

const CATEGORIAS = [
  "Moradia",
  "Alimentação",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Investimentos",
  "Impostos",
  "Outros",
];

interface DespesaPessoal {
  id: string;
  data: string;
  pessoa: string;
  fornecedor: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  observacoes: string | null;
}

type Situacao = "pago" | "parcial" | "atrasado" | "apagar";
function situacao(d: DespesaPessoal): Situacao {
  if (d.pago) return "pago";
  if (d.valorPago > 0) return "parcial";
  if (d.data < hojeISO()) return "atrasado";
  return "apagar";
}
const SITUACAO_LABEL: Record<Situacao, string> = {
  pago: "Pago",
  parcial: "Parcial",
  atrasado: "Atrasado",
  apagar: "A pagar",
};
const SITUACAO_CLASSE: Record<Situacao, string> = {
  pago: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  parcial: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  atrasado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  apagar: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function despesaVazia(): Omit<DespesaPessoal, "id"> {
  return {
    data: hojeISO(),
    pessoa: "Paulo",
    fornecedor: "",
    categoria: "",
    descricao: "",
    valor: 0,
    valorPago: 0,
    saldoDevedor: 0,
    pago: false,
    dataPagamento: null,
    observacoes: "",
  };
}

export function DespesasPessoal() {
  const { user } = useAuth();
  // Controle Financeiro Pessoal é exclusivo do admin master (paulodick),
  // igual às demais telas dessa aba — não usa a regra por perfil.
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [despesas, setDespesas] = useState<DespesaPessoal[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [fPessoa, setFPessoa] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<DespesaPessoal, "id">>(despesaVazia());
  const [salvando, setSalvando] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const [carregandoBaixas, setCarregandoBaixas] = useState(false);

  const carregar = () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .listarDespesasPessoal("?pageSize=5000")
      .then((r) => setDespesas((r.data as DespesaPessoal[]) || []))
      .catch(() => setDespesas([]))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return despesas.filter((d) => {
      if (fPessoa && d.pessoa !== fPessoa) return false;
      if (!q) return true;
      return [d.fornecedor, d.categoria, d.descricao]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [despesas, busca, fPessoa]);

  const totais = useMemo(() => {
    const total = filtradas.reduce((s, d) => s + d.valor, 0);
    const pago = filtradas.reduce(
      (s, d) => s + (d.pago ? d.valor : d.valorPago),
      0,
    );
    const atrasado = filtradas
      .filter((d) => situacao(d) === "atrasado")
      .reduce((s, d) => s + d.saldoDevedor, 0);
    return { total, pago, pendente: total - pago, atrasado };
  }, [filtradas]);

  const abrirNova = () => {
    setEditId(null);
    setForm(despesaVazia());
    setBaixas([]);
    setModalAberto(true);
  };

  const carregarBaixas = (id: string) => {
    setCarregandoBaixas(true);
    api
      .listarBaixasDespesaPessoal(id)
      .then(setBaixas)
      .catch(() => setBaixas([]))
      .finally(() => setCarregandoBaixas(false));
  };

  const abrirEdicao = (d: DespesaPessoal) => {
    setEditId(d.id);
    setForm({
      data: d.data,
      pessoa: d.pessoa,
      fornecedor: d.fornecedor,
      categoria: d.categoria || "",
      descricao: d.descricao || "",
      valor: d.valor,
      valorPago: d.valorPago,
      saldoDevedor: d.saldoDevedor,
      pago: d.pago,
      dataPagamento: d.dataPagamento,
      observacoes: d.observacoes || "",
    });
    carregarBaixas(d.id);
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.fornecedor.trim()) {
      alert("Informe o fornecedor / credor.");
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
      if (editId) await api.atualizarDespesaPessoal(editId, payload);
      else await api.criarDespesaPessoal(payload);
      setModalAberto(false);
      carregar();
    } catch (e) {
      alert("Erro ao salvar a despesa: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const registrarBaixa = async (baixa: NovaBaixa) => {
    if (!editId) return;
    const atualizada = await api.registrarBaixaDespesaPessoal(editId, baixa);
    setForm((f) => ({
      ...f,
      valorPago: atualizada.valorPago,
      saldoDevedor: atualizada.saldoDevedor,
      pago: atualizada.pago,
      dataPagamento: atualizada.dataPagamento,
    }));
    carregarBaixas(editId);
    carregar();
  };

  const removerBaixa = async (baixaId: string) => {
    if (!editId) return;
    const atualizada = await api.removerBaixaDespesaPessoal(editId, baixaId);
    setForm((f) => ({
      ...f,
      valorPago: atualizada.valorPago,
      saldoDevedor: atualizada.saldoDevedor,
      pago: atualizada.pago,
    }));
    carregarBaixas(editId);
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluirId) return;
    try {
      await api.removerDespesaPessoal(excluirId);
      setExcluirId(null);
      carregar();
    } catch (e) {
      alert("Erro ao excluir: " + (e as Error).message);
    }
  };

  const temFiltro = !!(busca || fPessoa);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text">Despesas Pessoais</h1>
          <p className="text-sm text-text-muted">
            Contas a pagar e pagas de Paulo/Luisa — separado da empresa.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNova} icon={<Plus size={18} />}>
            Nova despesa
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Total</div>
          <div className="mt-1 text-xl font-semibold text-text">{formatBRL(totais.total)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Pago</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.pago)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">A pagar</div>
          <div className="mt-1 text-xl font-semibold text-amber-600 dark:text-amber-400">
            {formatBRL(totais.pendente)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Atrasado</div>
          <div className="mt-1 text-xl font-semibold text-red-600 dark:text-red-400">
            {formatBRL(totais.atrasado)}
          </div>
        </div>
      </div>

      <Block title="Lançamentos" icon={<Wallet size={18} />}>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="max-w-sm flex-1">
            <Input
              placeholder="Buscar por fornecedor, categoria..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              icon={<Search size={16} />}
            />
          </div>
          <Select value={fPessoa} onChange={(e) => setFPessoa(e.target.value)}>
            <option value="">Todas as pessoas</option>
            {PESSOAS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </Select>
          {temFiltro && (
            <Button
              variant="secondary"
              onClick={() => {
                setBusca("");
                setFPessoa("");
              }}
              title="Limpar filtros"
              className="px-2"
            >
              <X size={16} />
            </Button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="px-2 py-2">Pessoa</th>
                <th className="px-2 py-2">Data</th>
                <th className="px-2 py-2">Fornecedor</th>
                <th className="px-2 py-2">Categoria</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Valor pago</th>
                <th className="px-2 py-2 text-right">Saldo devedor</th>
                <th className="px-2 py-2 text-center">Situação</th>
                {podeEditar && <th className="px-2 py-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((d) => {
                const s = situacao(d);
                return (
                  <tr
                    key={d.id}
                    onClick={() => podeEditar && abrirEdicao(d)}
                    className={`border-b border-border/60 hover:bg-surface-offset/40 ${podeEditar ? "cursor-pointer" : ""}`}
                  >
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-text">{d.pessoa}</td>
                    <td className="whitespace-nowrap px-2 py-2">{formatDataBR(d.data)}</td>
                    <td className="px-2 py-2 font-medium text-text">
                      {d.fornecedor}
                      {d.descricao && (
                        <div className="text-xs text-text-muted">{d.descricao}</div>
                      )}
                    </td>
                    <td className="px-2 py-2">{d.categoria || "—"}</td>
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
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUACAO_CLASSE[s]}`}>
                        {SITUACAO_LABEL[s]}
                      </span>
                    </td>
                    {podeEditar && (
                      <td className="whitespace-nowrap px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => abrirEdicao(d)}
                          title="Editar / registrar baixa"
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
                );
              })}
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={podeEditar ? 9 : 8} className="px-2 py-8 text-center text-text-muted">
                    {carregando ? "Carregando..." : "Nenhuma despesa cadastrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>

      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editId ? "Editar despesa" : "Nova despesa"}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Pessoa"
              value={form.pessoa}
              onChange={(e) => setForm({ ...form, pessoa: e.target.value })}
            >
              {PESSOAS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </Select>
            <Input
              label="Data"
              type="date"
              value={form.data}
              onChange={(e) => setForm({ ...form, data: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Valor a pagar (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.valor || ""}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) || 0 })}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Valor pago (R$)</label>
              <div className="flex h-[38px] items-center rounded-md border border-border bg-surface-offset/40 px-3 text-sm text-text">
                {formatBRL(form.valorPago || 0)}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Saldo devedor (R$)</label>
              <div className="flex h-[38px] items-center rounded-md border border-border bg-surface-offset/40 px-3 text-sm text-text">
                {formatBRL(Math.max(0, (form.valor || 0) - (form.valorPago || 0)))}
              </div>
            </div>
          </div>
          <Input
            label="Fornecedor / credor"
            value={form.fornecedor}
            onChange={(e) => setForm({ ...form, fornecedor: e.target.value })}
            required
          />
          <Select
            label="Categoria"
            value={form.categoria || ""}
            onChange={(e) => setForm({ ...form, categoria: e.target.value })}
          >
            <option value="">Selecione...</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Input
            label="Descrição"
            value={form.descricao || ""}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
          />
          <Textarea
            label="Observações"
            rows={2}
            value={form.observacoes || ""}
            onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
          />

          {editId ? (
            carregandoBaixas ? (
              <p className="text-sm text-text-faint">Carregando baixas...</p>
            ) : (
              <PainelBaixas
                baixas={baixas}
                saldoDevedor={form.saldoDevedor}
                acaoLabel="Registrar baixa"
                podeEditar={podeEditar}
                onRegistrar={registrarBaixa}
                onRemover={removerBaixa}
              />
            )
          ) : (
            <p className="rounded-md bg-surface-offset/40 p-3 text-xs text-text-faint">
              Salve a despesa antes de registrar uma baixa (pagamento total ou parcial).
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!excluirId}
        onClose={() => setExcluirId(null)}
        title="Excluir despesa"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setExcluirId(null)}>Cancelar</Button>
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
          Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
