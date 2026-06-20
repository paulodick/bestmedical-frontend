import type { Orcamento } from "../types";
import { formatBRL, formatDataBR, subtotalItem } from "../lib/format";
import { totalFinal, totalBruto, valorDesconto } from "../lib/calc";
import logoSymbol from "../assets/logo-symbol.png";

// Visualização final do orçamento — apresentação para o cliente.
// O desconto é exibido (subtotal + desconto + total) somente quando houver;
// sem desconto, mostra apenas o total final.
export function OrcamentoPreview({ o }: { o: Orcamento }) {
  const marcaExibida =
    o.marca === "Outras" ? o.marcaOutras || "Outras" : o.marca;
  const itensValidos = o.itens.filter((it) => it.item || it.codigo || it.valorItem);

  return (
    <div className="relative mx-auto max-w-[760px] overflow-hidden bg-white p-8 text-[13px] text-slate-800 print:p-0">
      {/* Marca d'água central discreta */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center"
      >
        <img
          src={logoSymbol}
          alt=""
          className="w-[55%] max-w-[360px] opacity-[0.04]"
        />
      </div>
      <div className="relative">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <img
              src={logoSymbol}
              alt="Best Medical"
              className="h-11 w-auto object-contain"
            />
            <div>
              <div className="text-[16px] font-bold leading-none text-slate-900">
                Best Medical
              </div>
              <div className="text-[11px] text-slate-500">
                Manutenção de Equipamentos Médicos
              </div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[15px] font-bold text-slate-900">ORÇAMENTO</div>
          <div className="mt-1 text-[12px] text-slate-600">
            Nº <span className="font-semibold">{o.numero}</span>
          </div>
          <div className="text-[12px] text-slate-600">
            Data: <span className="font-semibold">{formatDataBR(o.data)}</span>
          </div>
        </div>
      </div>

      {/* Cliente + Solicitante */}
      <div className="mt-5 grid grid-cols-2 gap-6">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Cliente
          </div>
          <div className="font-semibold text-slate-900">{o.empresa || "—"}</div>
          {o.cnpj && <div className="text-slate-600">CNPJ: {o.cnpj}</div>}
          {(o.endereco || o.cidade) && (
            <div className="mt-1 text-slate-600">
              {o.endereco}
              {o.bairro && `, ${o.bairro}`}
              <br />
              {[o.cidade, o.estado].filter(Boolean).join(" - ")}
              {o.cep && ` — CEP ${o.cep}`}
              {o.pais && <><br />{o.pais}</>}
            </div>
          )}
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
            Solicitante
          </div>
          <div className="font-semibold text-slate-900">
            {o.solicitante || "—"}
          </div>
          {o.setor && <div className="text-slate-600">{o.setor}</div>}
          {o.telefone && <div className="text-slate-600">{o.telefone}</div>}
          {o.email && <div className="text-slate-600">{o.email}</div>}
        </div>
      </div>

      {/* Dados técnicos */}
      <div className="mt-5 rounded-md bg-slate-50 p-4">
        <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Dados do Equipamento
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-slate-700">
          {o.modalidade && (
            <div><span className="text-slate-400">Modalidade:</span> {o.modalidade}</div>
          )}
          {marcaExibida && (
            <div><span className="text-slate-400">Marca:</span> {marcaExibida}</div>
          )}
          {o.modelo && (
            <div><span className="text-slate-400">Modelo:</span> {o.modelo}</div>
          )}
          {o.numeroSerie && (
            <div><span className="text-slate-400">Nº de série:</span> {o.numeroSerie}</div>
          )}
        </div>
        {o.descricaoVisita && (
          <div className="mt-2 text-slate-700">
            <span className="text-slate-400">Descrição da visita técnica:</span>{" "}
            {o.descricaoVisita}
          </div>
        )}
      </div>

      {/* Itens */}
      <table className="mt-5 w-full text-[12px]">
        <thead>
          <tr className="border-b border-slate-300 text-left text-slate-500">
            <th className="py-2 font-semibold">Código</th>
            <th className="py-2 font-semibold">Item</th>
            <th className="py-2 text-center font-semibold">Qtd.</th>
            <th className="py-2 text-right font-semibold">Valor unit.</th>
            <th className="py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody>
          {itensValidos.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-4 text-center text-slate-400">
                Nenhum item adicionado.
              </td>
            </tr>
          ) : (
            itensValidos.map((it) => (
              <tr key={it.id} className="border-b border-slate-100">
                <td className="py-2 text-slate-600">{it.codigo || "—"}</td>
                <td className="py-2 text-slate-800">{it.item || "—"}</td>
                <td className="py-2 text-center text-slate-700">{it.quantidade}</td>
                <td className="py-2 text-right tabular-nums text-slate-700">
                  {formatBRL(it.valorItem)}
                </td>
                <td className="py-2 text-right font-medium tabular-nums text-slate-900">
                  {formatBRL(subtotalItem(it.quantidade, it.valorItem))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Resumo final — exibe desconto somente quando houver */}
      <div className="mt-4 flex justify-end">
        <div className="w-72">
          {o.descontoPercent > 0 && (
            <div className="mb-2 space-y-1 px-1 text-[12px] text-slate-600">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatBRL(totalBruto(o))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Desconto ({o.descontoPercent}%)</span>
                <span className="tabular-nums">
                  - {formatBRL(valorDesconto(o))}
                </span>
              </div>
            </div>
          )}
          <div className="rounded-md bg-[#0d7d8a] px-4 py-3 text-right text-white">
            <div className="text-[10px] uppercase tracking-wide opacity-80">
              Total do Orçamento
            </div>
            <div className="text-[20px] font-bold tabular-nums">
              {formatBRL(totalFinal(o))}
            </div>
          </div>
        </div>
      </div>

      {/* Condições de pagamento — só quando houver parcelamento (2+ parcelas) */}
      {o.numParcelas > 1 && o.parcelas.length > 1 && (
        <div className="mt-6">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            Condições de Pagamento — {o.numParcelas}x
          </div>
          <table className="w-full max-w-md text-[12px]">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                <th className="py-1.5 font-semibold">Parcela</th>
                <th className="py-1.5 font-semibold">Vencimento</th>
                <th className="py-1.5 text-right font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {o.parcelas.map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-700">{p.numero}</td>
                  <td className="py-1.5 text-slate-700">
                    {p.data ? formatDataBR(p.data) : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-slate-800">
                    {formatBRL(p.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Observações / texto final */}
      {(o.observacoes || o.textoFinal) && (
        <div className="mt-6 space-y-2 border-t border-slate-200 pt-4 text-[12px] text-slate-600">
          {o.observacoes && (
            <div>
              <span className="font-semibold text-slate-700">Observações: </span>
              {o.observacoes}
            </div>
          )}
          {o.textoFinal && <div>{o.textoFinal}</div>}
        </div>
      )}

      <div className="mt-8 flex flex-col items-center gap-0.5 text-center">
        <span className="text-[12px] font-semibold italic tracking-wide text-[#0d7d8a]">
          When uptime matters.
        </span>
        <span className="text-[10px] text-slate-400">
          Best Medical • Documento gerado pelo sistema interno de orçamentos
        </span>
      </div>
      </div>
    </div>
  );
}
