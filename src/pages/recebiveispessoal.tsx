import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, X, Wallet } from "lucide-react";
import { useAuth } from "../auth";
import { Modal } from "../components/Modal";
import { Button, Input, Select, Textarea, Block } from "../components/ui";
import { PainelBaixas } from "../components/PainelBaixas";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import { api, API_ENABLED, type Baixa, type NovaBaixa } from "../lib/api";

const PESSOAS = ["Paulo", "Luisa"];

interface RecebivelPessoal {
  id: string;
  data: string;
  pessoa: string;
  origem: string;
  descricao: string | null;
  valor: number;
  valorPago: number;
  saldoDevedor: number;
  pago: boolean;
  dataPagamento: string | null;
  condicaoPagamento: string | null;
  observacoes: string | null;
}

type Situacao = "recebido" | "parcial" | "atrasado" | "areceber";
function situacao(r: RecebivelPessoal): Situacao {
  if (r.pago) return "recebido";
  if (r.valorPago > 0) return "parcial";
  if (r.dataPagamento && r.dataPagamento < hojeISO()) return "atrasado";
  return "areceber";
}
const SITUACAO_LABEL: Record<Situacao, string> = {
  recebido: "Recebido",
  parcial: "Parcial",
  atrasado: "Atrasado",
  areceber: "A receber",
};
const SITUACAO_CLASSE: Record<Situacao, string> = {
  recebido: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  parcial: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  atrasado: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  areceber: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

function recebivelVazio(): Omit<RecebivelPessoal, "id"> {
  return {
    data: hojeISO(),
    pessoa: "Paulo",
    origem: "",
    descricao: "",
    valor: 0,
    valorPago: 0,
    saldoDevedor: 0,
    pago: false,
    dataPagamento: null,
    condicaoPagamento: null,
    observacoes: "",
  };
}

export function RecebiveisPessoal() {
  const { user } = useAuth();
  const podeEditar = (user?.usuario || "").toLowerCase() === "paulodick";

  const [recebiveis, setRecebiveis] = useState<RecebivelPessoal[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [busca, setBusca] = useState("");
  const [fPessoa, setFPessoa] = useState("");

  const [modalAberto, setModalAberto] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<RecebivelPessoal, "id">>(recebivelVazio());
  const [salvando, setSalvando] = useState(false);
  const [excluirId, setExcluirId] = useState<string | null>(null);

  const [baixas, setBaixas] = useState<Baixa[]>([]);
  const [carregandoBaixas, setCarregandoBaixas] = useState(false);

  const carregar = () => {
    if (!API_ENABLED) return;
    setCarregando(true);
    api
      .listarRecebiveisPessoal("?pageSize=5000")
      .then((r) => setRecebiveis((r.data as RecebivelPessoal[]) || []))
      .catch(() => setRecebiveis([]))
      .finally(() => setCarregando(false));
  };

  useEffect(carregar, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return recebiveis.filter((r) => {
      if (fPessoa && r.pessoa !== fPessoa) return false;
      if (!q) return true;
      return [r.origem, r.descricao]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q));
    });
  }, [recebiveis, busca, fPessoa]);

  const totais = useMemo(() => {
    const total = filtrados.reduce((s, r) => s + r.valor, 0);
    const recebido = filtrados.reduce(
      (s, r) => s + (r.pago ? r.valor : r.valorPago),
      0,
    );
    const atrasado = filtrados
      .filter((r) => situacao(r) === "atrasado")
      .reduce((s, r) => s + r.saldoDevedor, 0);
    return { total, recebido, aReceber: total - recebido, atrasado };
  }, [filtrados]);

  const abrirNovo = () => {
    setEditId(null);
    setForm(recebivelVazio());
    setBaixas([]);
    setModalAberto(true);
  };

  const carregarBaixas = (id: string) => {
    setCarregandoBaixas(true);
    api
      .listarBaixasRecebivelPessoal(id)
      .then(setBaixas)
      .catch(() => setBaixas([]))
      .finally(() => setCarregandoBaixas(false));
  };

  const abrirEdicao = (r: RecebivelPessoal) => {
    setEditId(r.id);
    setForm({
      data: r.data,
      pessoa: r.pessoa,
      origem: r.origem,
      descricao: r.descricao || "",
      valor: r.valor,
      valorPago: r.valorPago,
      saldoDevedor: r.saldoDevedor,
      pago: r.pago,
      dataPagamento: r.dataPagamento,
      condicaoPagamento: r.condicaoPagamento,
      observacoes: r.observacoes || "",
    });
    carregarBaixas(r.id);
    setModalAberto(true);
  };

  const salvar = async () => {
    if (!form.origem.trim()) {
      alert("Informe a origem (quem paga).");
      return;
    }
    setSalvando(true);
    const payload = {
      ...form,
      descricao: form.descricao || undefined,
      observacoes: form.observacoes || undefined,
      dataPagamento: form.dataPagamento || undefined,
    };
    try {
      if (editId) await api.atualizarRecebivelPessoal(editId, payload);
      else await api.criarRecebivelPessoal(payload);
      setModalAberto(false);
      carregar();
    } catch (e) {
      alert("Erro ao salvar o recebível: " + (e as Error).message);
    } finally {
      setSalvando(false);
    }
  };

  const registrarBaixa = async (baixa: NovaBaixa) => {
    if (!editId) return;
    const atualizado = await api.registrarBaixaRecebivelPessoal(editId, baixa);
    setForm((f) => ({
      ...f,
      valorPago: atualizado.valorPago,
      saldoDevedor: atualizado.saldoDevedor,
      pago: atualizado.pago,
      dataPagamento: atualizado.dataPagamento,
    }));
    carregarBaixas(editId);
    carregar();
  };

  const removerBaixa = async (baixaId: string) => {
    if (!editId) return;
    const atualizado = await api.removerBaixaRecebivelPessoal(editId, baixaId);
    setForm((f) => ({
      ...f,
      valorPago: atualizado.valorPago,
      saldoDevedor: atualizado.saldoDevedor,
      pago: atualizado.pago,
    }));
    carregarBaixas(editId);
    carregar();
  };

  const confirmarExclusao = async () => {
    if (!excluirId) return;
    try {
      await api.removerRecebivelPessoal(excluirId);
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
          <h1 className="text-2xl font-semibold text-text">Recebíveis Pessoais</h1>
          <p className="text-sm text-text-muted">
            Receitas de Paulo/Luisa — separado da empresa.
          </p>
        </div>
        {podeEditar && (
          <Button onClick={abrirNovo} icon={<Plus size={18} />}>
            Novo recebível
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Total</div>
          <div className="mt-1 text-xl font-semibold text-text">{formatBRL(totais.total)}</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">Recebido</div>
          <div className="mt-1 text-xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatBRL(totais.recebido)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="text-xs uppercase tracking-wide text-text-muted">A receber</div>
          <div className="mt-1 text-xl font-semibold text-sky-600 dark:text-sky-400">
            {formatBRL(totais.aReceber)}
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
              placeholder="Buscar por origem, descrição..."
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
                <th className="px-2 py-2">Origem</th>
                <th className="px-2 py-2 text-right">Valor</th>
                <th className="px-2 py-2 text-right">Valor recebido</th>
                <th className="px-2 py-2 text-right">Saldo devedor</th>
                <th className="px-2 py-2 text-center">Situação</th>
                {podeEditar && <th className="px-2 py-2 text-center">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const s = situacao(r);
                return (
                  <tr
                    key={r.id}
                    onClick={() => podeEditar && abrirEdicao(r)}
                    className={`border-b border-border/60 hover:bg-surface-offset/40 ${podeEditar ? "cursor-pointer" : ""}`}
                  >
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-text">{r.pessoa}</td>
                    <td className="whitespace-nowrap px-2 py-2">{formatDataBR(r.data)}</td>
                    <td className="px-2 py-2 font-medium text-text">
                      {r.origem}
                      {r.descricao && (
                        <div className="text-xs text-text-muted">{r.descricao}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBRL(r.valor)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {r.valorPago ? formatBRL(r.valorPago) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBRL(r.saldoDevedor)}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SITUACAO_CLASSE[s]}`}>
                        {SITUACAO_LABEL[s]}
                      </span>
                    </td>
                    {podeEditar && (
                      <td className="whitespace-nowrap px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => abrirEdicao(r)}
                          title="Editar / registrar baixa"
                          className="mr-1 rounded p-1.5 text-text-muted hover:bg-surface-offset hover:text-text"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => setExcluirId(r.id)}
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
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={podeEditar ? 8 : 7} className="px-2 py-8 text-center text-text-muted">
                    {carregando ? "Carregando..." : "Nenhum recebível cadastrado."}
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
        title={editId ? "Editar recebível" : "Novo recebível"}
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
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.valor || ""}
              onChange={(e) => setForm({ ...form, valor: Number(e.target.value) || 0 })}
            />
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Valor recebido (R$)</label>
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
            label="Origem (quem paga)"
            value={form.origem}
            onChange={(e) => setForm({ ...form, origem: e.target.value })}
            required
          />
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
              Salve o recebível antes de registrar uma baixa (recebimento total ou parcial).
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={!!excluirId}
        onClose={() => setExcluirId(null)}
        title="Excluir recebível"
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
          Tem certeza que deseja excluir este recebível? Esta ação não pode ser desfeita.
        </p>
      </Modal>
    </div>
  );
}
