import type { Parcela } from "../types";
import {
  formatBRL,
  moedaParaInput,
  parseMoedaInput,
  maskDataBR,
  brParaISO,
  isoParaBR,
} from "../lib/format";
import {
  addDias,
  gerarParcelas,
  redistribuirValores,
  somaParcelas,
} from "../lib/calc";

// Recebe número de parcelas, total e a lista atual; emite atualizações.
export function Parcelamento({
  numParcelas,
  parcelas,
  total,
  onChangeNum,
  onChangeParcelas,
}: {
  numParcelas: number;
  parcelas: Parcela[];
  total: number;
  onChangeNum: (n: number) => void;
  onChangeParcelas: (p: Parcela[]) => void;
}) {
  // Altera o número de parcelas -> regenera a tabela mantendo datas/1ª data
  const setNum = (raw: string) => {
    const n = Math.max(1, Math.min(360, parseInt(raw || "1", 10) || 1));
    onChangeNum(n);
    onChangeParcelas(gerarParcelas(n, total, parcelas));
  };

  // Edita a data de uma parcela. As datas subsequentes são recalculadas
  // (+30 dias acumulado) a partir da editada; todas permanecem editáveis.
  const setData = (idx: number, brValue: string) => {
    const iso = brParaISO(maskDataBR(brValue));
    const novas: Parcela[] = parcelas.map((p, i) =>
      i === idx ? { ...p, data: iso } : { ...p }
    );
    if (iso) {
      for (let i = idx + 1; i < novas.length; i++) {
        novas[i] = { ...novas[i], data: addDias(novas[i - 1].data, 30) };
      }
    }
    onChangeParcelas(novas);
  };

  // Edita o valor de uma parcela. Trava o valor editado (e os anteriores)
  // e redistribui o restante igualmente entre as parcelas seguintes.
  const setValor = (idx: number, raw: string) => {
    const valor = parseMoedaInput(raw);
    const novas = parcelas.map((p, i) => (i === idx ? { ...p, valor } : p));
    onChangeParcelas(redistribuirValores(novas, total, idx));
  };

  // Guarda do texto digitado na data (para máscara enquanto incompleto)
  // Mantemos um estado leve por linha via atributo data-* no input.
  const soma = somaParcelas(parcelas);
  const diferenca = Math.round((total - soma) * 100) / 100;

  return (
    <div className="mt-5 border-t border-divider pt-5">
      {/* Campo Parcelamento — alinhado à esquerda, respeitando a margem da tabela */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium text-text-muted">
          Parcelamento
        </label>
        <input
          type="number"
          min={1}
          value={numParcelas}
          onChange={(e) => setNum(e.target.value)}
          className="w-20 rounded-md border border-border bg-surface px-3 py-1.5 text-[14px] text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <span className="text-[12px] text-text-faint">
          {numParcelas === 1 ? "à vista / 1 parcela" : `${numParcelas} parcelas`}
        </span>
      </div>

      {/* Tabela Controle de Pagamento */}
      <div className="max-w-xl">
        <div className="mb-2 text-[13px] font-semibold text-text">
          Controle de Pagamento
        </div>
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-surface-offset text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                <th className="w-20 px-3 py-2">Parcela</th>
                <th className="px-3 py-2">Data Pagamento</th>
                <th className="w-40 px-3 py-2 text-right">Valor da Parcela</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-divider">
              {parcelas.map((p, i) => (
                <tr key={p.id} className="bg-surface">
                  <td className="px-3 py-1.5 text-center font-medium tabular-nums text-text-muted">
                    {p.numero}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      defaultValue={isoParaBR(p.data)}
                      key={p.data + p.id}
                      onChange={(e) => {
                        e.target.value = maskDataBR(e.target.value);
                      }}
                      onBlur={(e) => setData(i, e.target.value)}
                      placeholder="dd/mm/aaaa"
                      inputMode="numeric"
                      className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 text-text placeholder:text-text-faint hover:border-border focus:border-primary focus:bg-surface focus:outline-none"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center justify-end rounded border border-transparent pr-1 hover:border-border focus-within:border-primary focus-within:bg-surface">
                      <span className="pl-2 text-[12px] text-text-faint">R$</span>
                      <input
                        inputMode="numeric"
                        value={moedaParaInput(p.valor)}
                        onChange={(e) => setValor(i, e.target.value)}
                        title="Ao alterar uma parcela, as parcelas seguintes são recalculadas"
                        className="w-full bg-transparent px-1.5 py-1.5 text-right text-text focus:outline-none"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-surface-2 text-[12px]">
                <td colSpan={2} className="px-3 py-2 text-right font-medium text-text-muted">
                  Soma das parcelas
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold tabular-nums ${
                    diferenca === 0 ? "text-text" : "text-danger"
                  }`}
                >
                  {formatBRL(soma)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {diferenca !== 0 && (
          <p className="mt-1.5 text-[12px] text-danger">
            A soma das parcelas difere do total em {formatBRL(Math.abs(diferenca))}.
          </p>
        )}
      </div>
    </div>
  );
}
