import type { Orcamento, ItemOrcamento, Parcela } from "../types";
import { subtotalItem, uid } from "./format";

export const somaItens = (itens: ItemOrcamento[]): number =>
  itens.reduce((acc, it) => acc + subtotalItem(it.quantidade, it.valorItem), 0);

// Total bruto (sem desconto)
export const totalBruto = (o: Pick<Orcamento, "itens">): number =>
  somaItens(o.itens);

// Valor do desconto em reais
export const valorDesconto = (
  o: Pick<Orcamento, "itens" | "descontoPercent">
): number => totalBruto(o) * ((o.descontoPercent || 0) / 100);

// Total final (com desconto aplicado) — este é o valor mostrado ao cliente.
// Quando há um total manual (override > 0), ele prevalece sobre o cálculo
// baseado nos itens/desconto (usado para correção rápida no Controle).
export const totalFinal = (
  o: Pick<Orcamento, "itens" | "descontoPercent"> & {
    totalManual?: number | null;
  }
): number => {
  if (o.totalManual != null && o.totalManual > 0) return o.totalManual;
  return totalBruto(o) - valorDesconto(o);
};

// ===== Parcelamento / Controle de Pagamento =====

// Arredonda para 2 casas (centavos)
const round2 = (v: number) => Math.round(v * 100) / 100;

// Soma N dias a uma data ISO (yyyy-mm-dd), retornando ISO. Usa dias corridos.
export const addDias = (iso: string, dias: number): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + dias);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

// Distribui um total igualmente entre N parcelas, ajustando o residual
// de centavos na última parcela para que a soma feche exatamente.
const distribuirIgual = (total: number, n: number): number[] => {
  if (n <= 0) return [];
  const base = round2(total / n);
  const valores = Array(n).fill(base);
  const somaSemUltima = round2(base * (n - 1));
  valores[n - 1] = round2(total - somaSemUltima);
  return valores;
};

// Recalcula a lista de parcelas com base no número de parcelas e no total.
// - mantém datas já preenchidas quando possível;
// - primeira data é base; demais = +30 dias acumulados a partir da anterior;
// - valores divididos igualmente.
export const gerarParcelas = (
  numParcelas: number,
  total: number,
  anteriores: Parcela[] = []
): Parcela[] => {
  const n = Math.max(1, Math.floor(numParcelas || 1));
  const valores = distribuirIgual(total, n);
  const primeiraData = anteriores[0]?.data || "";

  const out: Parcela[] = [];
  for (let i = 0; i < n; i++) {
    const prev = anteriores[i];
    let data = prev?.data || "";
    // Datas subsequentes: se vazias, +30 dias a partir da anterior gerada
    if (i > 0 && !data && out[i - 1]?.data) {
      data = addDias(out[i - 1].data, 30);
    }
    if (i === 0) data = primeiraData;
    out.push({
      id: prev?.id || uid(),
      numero: i + 1,
      data,
      valor: valores[i],
    });
  }
  return out;
};

// Redistribui valores a partir de uma parcela editada (idxEditado):
// - as parcelas até idxEditado (inclusive) mantêm seus valores;
// - o restante do total é dividido igualmente entre as parcelas seguintes.
// A soma sempre fecha com o total. Quando idxEditado = 0 (padrão), reproduz
// o comportamento da parcela 1.
export const redistribuirValores = (
  parcelas: Parcela[],
  total: number,
  idxEditado = 0
): Parcela[] => {
  const n = parcelas.length;
  if (n === 0) return parcelas;
  if (n === 1) return [{ ...parcelas[0], valor: round2(total) }];

  const idx = Math.min(Math.max(0, idxEditado), n - 1);

  // Soma das parcelas fixas (0..idx)
  const somaFixas = round2(
    parcelas.slice(0, idx + 1).reduce((acc, p) => acc + round2(p.valor || 0), 0)
  );
  const restante = round2(total - somaFixas);
  const qtdSeguintes = n - (idx + 1);

  // Se a parcela editada é a última, não há seguintes para redistribuir.
  if (qtdSeguintes <= 0) {
    return parcelas.map((p) => ({ ...p, valor: round2(p.valor || 0) }));
  }

  const seguintes = distribuirIgual(restante, qtdSeguintes);
  return parcelas.map((p, i) => {
    if (i <= idx) return { ...p, valor: round2(p.valor || 0) };
    return { ...p, valor: seguintes[i - (idx + 1)] };
  });
};

// Soma das parcelas (para conferir contra o total)
export const somaParcelas = (parcelas: Parcela[]): number =>
  round2(parcelas.reduce((acc, p) => acc + (p.valor || 0), 0));
