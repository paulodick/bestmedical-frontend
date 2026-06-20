import { Plus, Trash2 } from "lucide-react";
import type { ItemOrcamento } from "../types";
import {
  formatBRL,
  moedaParaInput,
  parseMoedaInput,
  subtotalItem,
  uid,
} from "../lib/format";

export function ItensGrid({
  itens,
  onChange,
}: {
  itens: ItemOrcamento[];
  onChange: (itens: ItemOrcamento[]) => void;
}) {
  const update = (id: string, patch: Partial<ItemOrcamento>) =>
    onChange(itens.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const addLinha = () =>
    onChange([
      ...itens,
      { id: uid(), codigo: "", item: "", quantidade: 1, valorItem: 0 },
    ]);

  const remover = (id: string) =>
    onChange(itens.length > 1 ? itens.filter((it) => it.id !== id) : itens);

  return (
    <div>
      <div className="overflow-x-auto thin-scroll rounded-md border border-border">
        <table className="w-full min-w-[680px] text-[14px]">
          <thead>
            <tr className="bg-surface-offset text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted">
              <th className="px-3 py-2.5 font-semibold">Código do Produto</th>
              <th className="px-3 py-2.5 font-semibold">Item</th>
              <th className="w-24 px-3 py-2.5 text-center font-semibold">Qtd.</th>
              <th className="w-36 px-3 py-2.5 text-right font-semibold">
                Valor do Item
              </th>
              <th className="w-36 px-3 py-2.5 text-right font-semibold">
                Valor Total
              </th>
              <th className="w-12 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-divider">
            {itens.map((it) => (
              <tr key={it.id} className="bg-surface hover:bg-surface-2">
                <td className="px-2 py-1.5">
                  <input
                    value={it.codigo}
                    onChange={(e) => update(it.id, { codigo: e.target.value })}
                    placeholder="Ex.: BOB-1521"
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-text placeholder:text-text-faint hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    value={it.item}
                    onChange={(e) => update(it.id, { item: e.target.value })}
                    placeholder="Descrição do item"
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-text placeholder:text-text-faint hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="number"
                    min={1}
                    value={it.quantidade}
                    onChange={(e) =>
                      update(it.id, {
                        quantidade: Math.max(1, parseInt(e.target.value || "1", 10)),
                      })
                    }
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-center text-text hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center justify-end rounded border border-transparent pr-1 hover:border-border focus-within:border-primary focus-within:bg-surface">
                    <span className="pl-2 text-[12px] text-text-faint">R$</span>
                    <input
                      inputMode="numeric"
                      value={moedaParaInput(it.valorItem)}
                      onChange={(e) =>
                        update(it.id, { valorItem: parseMoedaInput(e.target.value) })
                      }
                      className="w-full bg-transparent px-1.5 py-1.5 text-right text-text focus:outline-none"
                    />
                  </div>
                </td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums text-text">
                  {formatBRL(subtotalItem(it.quantidade, it.valorItem))}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => remover(it.id)}
                    disabled={itens.length === 1}
                    title="Remover linha"
                    className="rounded p-1.5 text-text-faint transition hover:bg-danger-soft hover:text-danger disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-text-faint"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={addLinha}
        className="mt-3 inline-flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-[13px] font-medium text-primary transition hover:border-primary hover:bg-primary-soft/40"
      >
        <Plus size={16} />
        Adicionar linha
      </button>
    </div>
  );
}
