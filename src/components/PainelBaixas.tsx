import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button, Input, Select } from "./ui";
import { formatBRL, formatDataBR, hojeISO } from "../lib/format";
import type { Baixa, FormaPagamento, NovaBaixa } from "../lib/api";

const FORMAS: FormaPagamento[] = [
  "Pix",
  "Boleto",
  "Transferência",
  "Cartão",
  "Dinheiro",
  "Outro",
];

// Painel de histórico de baixas (pagamentos/recebimentos totais ou
// parciais) + formulário para registrar uma nova. Usado em Despesas,
// Recebíveis e seus equivalentes no Controle Financeiro Pessoal — mesma
// mecânica dos dois lados (quem paga e quem recebe).
export function PainelBaixas({
  baixas,
  saldoDevedor,
  acaoLabel,
  podeEditar,
  onRegistrar,
  onRemover,
}: {
  baixas: Baixa[];
  saldoDevedor: number;
  acaoLabel: string;
  podeEditar: boolean;
  onRegistrar: (baixa: NovaBaixa) => Promise<void>;
  onRemover: (baixaId: string) => Promise<void>;
}) {
  const [data, setData] = useState(hojeISO());
  const [valor, setValor] = useState<number | "">("");
  const [forma, setForma] = useState<FormaPagamento>("Pix");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const registrar = async () => {
    if (!valor || valor <= 0) {
      setErro("Informe um valor maior que zero.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      await onRegistrar({ data, valor: Number(valor), formaPagamento: forma });
      setValor("");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao registrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-3 border-t border-border pt-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-text-faint">
        Histórico de baixas
      </div>
      {baixas.length === 0 ? (
        <p className="text-sm text-text-faint">
          Nenhuma baixa registrada ainda.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-text-muted">
                <th className="py-1 pr-2">Data</th>
                <th className="py-1 pr-2">Forma</th>
                <th className="py-1 pr-2 text-right">Valor</th>
                {podeEditar && <th className="py-1 pr-2 text-center">—</th>}
              </tr>
            </thead>
            <tbody>
              {baixas.map((b) => (
                <tr key={b.id} className="border-t border-border/60">
                  <td className="py-1 pr-2 whitespace-nowrap">
                    {formatDataBR(b.data)}
                  </td>
                  <td className="py-1 pr-2">{b.formaPagamento}</td>
                  <td className="py-1 pr-2 text-right tabular-nums">
                    {formatBRL(b.valor)}
                  </td>
                  {podeEditar && (
                    <td className="py-1 pr-2 text-center">
                      <button
                        onClick={() => onRemover(b.id)}
                        title="Remover baixa"
                        className="rounded p-1 text-text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {podeEditar && saldoDevedor > 0 && (
        <div className="flex flex-wrap items-end gap-2 rounded-md bg-surface-offset/40 p-3">
          <Input
            label="Data"
            type="date"
            value={data}
            onChange={(e) => setData(e.target.value)}
            className="!w-auto"
          />
          <Input
            label="Valor (R$)"
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) =>
              setValor(e.target.value ? Number(e.target.value) : "")
            }
            className="!w-28"
            placeholder={formatBRL(saldoDevedor)}
          />
          <Select
            label="Forma"
            value={forma}
            onChange={(e) => setForma(e.target.value as FormaPagamento)}
            className="!w-auto"
          >
            {FORMAS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <Button onClick={registrar} disabled={enviando}>
            {enviando ? "Registrando..." : acaoLabel}
          </Button>
        </div>
      )}
      {erro && <p className="text-xs text-red-600 dark:text-red-400">{erro}</p>}
    </div>
  );
}
