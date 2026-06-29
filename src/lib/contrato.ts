// ===== Lógica de detecção/replicação das customizações + cálculos da proposta =====
// Espelha exatamente a fonte de verdade do backend
// (src/contratos/contrato-customizacoes.ts). Mantém o mesmo formato de
// marcadores e de diff para que front e back produzam o mesmo bloco.

import type { Proposta, EquipamentoProposta } from "../types";

export const MARCADOR_INICIO =
  "===== CUSTOMIZAÇÕES DAS CONDIÇÕES (automático) =====";
export const MARCADOR_FIM = "===== FIM DAS CUSTOMIZAÇÕES =====";

// Data dd/mm/aaaa (pt-BR) para datar o registro das customizações.
function dataBRHoje(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Diff linha a linha entre o texto atual e o padrão. Determinístico (mesma
// saída no front e no back para as mesmas entradas).
export function diffCondicoes(atual: string, padrao: string): string[] {
  const linhasAtual = (atual ?? "").split("\n");
  const linhasPadrao = (padrao ?? "").split("\n");
  const total = Math.max(linhasAtual.length, linhasPadrao.length);

  const mudancas: string[] = [];
  for (let i = 0; i < total; i++) {
    const a = linhasAtual[i];
    const p = linhasPadrao[i];

    if (a !== undefined && p !== undefined) {
      // Ambas existem: registra apenas se forem diferentes.
      if (a !== p) {
        mudancas.push(`Linha ${i + 1} alterada: "${a}" (padrão: "${p}")`);
      }
    } else if (a !== undefined) {
      // Só a atual existe → linha adicionada em relação ao padrão.
      mudancas.push(`Linha ${i + 1} adicionada: "${a}"`);
    } else if (p !== undefined) {
      // Só o padrão existe → linha removida em relação ao padrão.
      mudancas.push(`Linha ${i + 1} removida (padrão: "${p}")`);
    }
  }
  return mudancas;
}

// Remove o bloco automático (entre marcadores) preservando o texto manual.
function removerBloco(texto: string): string {
  const ini = texto.indexOf(MARCADOR_INICIO);
  if (ini === -1) return texto.trim();

  const fimIdx = texto.indexOf(MARCADOR_FIM, ini);
  if (fimIdx === -1) {
    // Marcador de fim ausente (texto corrompido): remove do início até o final.
    return texto.slice(0, ini).replace(/\s+$/, "").trim();
  }

  const antes = texto.slice(0, ini).replace(/\s+$/, "");
  const depois = texto.slice(fimIdx + MARCADOR_FIM.length).replace(/^\s+/, "");
  return [antes, depois].filter(Boolean).join("\n\n").trim();
}

// Gera o conteúdo final das Observações Internas:
//  - preserva o texto manual (fora dos marcadores);
//  - injeta/atualiza o bloco de customizações quando houver diferenças;
//  - remove o bloco quando não houver diferença.
export function montarObservacoesInternas(
  condicoes: string,
  padrao: string,
  observacoesAtuais: string,
): string {
  const manual = removerBloco(observacoesAtuais ?? "");
  const mudancas = diffCondicoes(condicoes ?? "", padrao ?? "");

  if (mudancas.length === 0) {
    // Sem diferenças: mantém apenas as anotações manuais.
    return manual;
  }

  const bloco = [
    MARCADOR_INICIO,
    `Customizações registradas em ${dataBRHoje()}:`,
    ...mudancas,
    MARCADOR_FIM,
  ].join("\n");

  return manual ? `${manual}\n\n${bloco}` : bloco;
}

// ===== Cálculos do resumo financeiro (mensal) =====

export const subtotalProposta = (
  equipamentos: EquipamentoProposta[],
): number =>
  (equipamentos || []).reduce((acc, e) => acc + (e.valorContrato || 0), 0);

export const valorDescontoProposta = (
  p: Pick<Proposta, "equipamentos" | "descontoPercent">,
): number => subtotalProposta(p.equipamentos) * ((p.descontoPercent || 0) / 100);

export const totalPropostaFinal = (
  p: Pick<Proposta, "equipamentos" | "descontoPercent">,
): number => subtotalProposta(p.equipamentos) - valorDescontoProposta(p);
