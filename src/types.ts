// ===== Tipos de domínio do sistema de orçamentos =====

// ===== Ordem de Serviço =====
export interface ItemOS {
  id?: string;
  codigo: string;
  item: string;       // espelha o campo 'descricao' no backend
  quantidade: number;
  realizado: boolean;
  detalhes: string;
}

export interface FotoOS {
  id?: string;
  dataUrl: string;   // base64 data URL (jpeg/png)
  legenda: string;
  ordem?: number;
}

export interface OrdemServico {
  id: string;
  numero: string;
  orcamentoId: string;
  data: string; // ISO yyyy-mm-dd
  // Empresa / endereço (snapshots)
  cnpj: string;
  empresa: string;
  cep: string;
  endereco: string;
  enderecoNumero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  // Solicitante
  solicitante: string;
  setor: string;
  telefone: string;
  email: string;
  // Equipamento
  modalidade: string;
  marca: string;
  marcaOutras: string;
  modelo: string;
  numeroSerie: string;
  descricaoVisita: string;
  // Campos próprios da OS
  descricaoServico: string;
  observacoes: string;
  assinaturaCliente: string;
  assinaturaTecnico: string;
  // Status
  enviado: boolean;
  // Listas
  itens: ItemOS[];
  fotos: FotoOS[];
}


export interface ItemOrcamento {
  id: string;
  codigo: string;
  item: string;
  quantidade: number;
  valorItem: number; // em centavos? não — usamos number em reais
}

export type StatusBooleano = boolean;

// Linha do controle de pagamento (parcelas)
export interface Parcela {
  id: string;
  numero: number;       // sequencial, não editável (1, 2, 3...)
  data: string;         // ISO yyyy-mm-dd — editável
  valor: number;        // valor da parcela em reais — editável (parcela 1)
}

export interface Orcamento {
  id: string;
  // Bloco 1 — Identificação
  numero: string;
  data: string; // ISO yyyy-mm-dd
  // Bloco 2 — Empresa
  cnpj: string;
  empresa: string;
  // Bloco 3 — Endereço
  cep: string;
  endereco: string;
  enderecoNumero: string; // número do imóvel (não vem do CEP)
  complemento: string;    // complemento (não vem do CEP)
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  // Bloco 4 — Solicitante
  solicitante: string;
  setor: string;
  telefone: string;
  email: string;
  // Bloco 5 — Dados técnicos
  modalidade: string;
  marca: string;
  marcaOutras: string;
  modelo: string;
  numeroSerie: string;
  descricaoVisita: string;
  // Bloco 6 — Itens + resumo
  itens: ItemOrcamento[];
  descontoPercent: number;
  numParcelas: number;       // campo Parcelamento (padrão 1)
  parcelas: Parcela[];       // Controle de Pagamento
  // Bloco 7 — Finalização
  observacoes: string;
  textoFinal: string;
  // Controle / status
  enviado: boolean;
  aprovado: boolean;
  realizado: boolean;
  aguardandoPeca: boolean;
  ordemServico: boolean;
  pagamentoRealizado: boolean;
}

export const MODALIDADES = [
  "Ressonância Magnética",
  "Tomografia",
  "Hemodinâmica",
  "Medicina Nuclear",
  "PET-CT",
  "Arco Cirúrgico",
  "Mamografia",
  "Raios X",
  "Ultrassom",
] as const;

export const MARCAS = [
  "GE",
  "Philips",
  "Siemens",
  "Toshiba",
  "Canon",
  "Hitachi",
  "Outras",
] as const;

// ===== Proposta de Contrato =====

// Tipos de contrato disponíveis (espelha o backend).
export const TIPOS_CONTRATO = [
  "Suporte Remoto",
  "Mão de Obra - Regular",
  "Mão de Obra - Especial",
] as const;

export type TipoContrato = (typeof TIPOS_CONTRATO)[number];

// Texto padrão da modalidade "Mão de Obra - Especial" (seções e bullets).
const MAO_DE_OBRA_ESPECIAL = `PONTOS DE ATENDIMENTO E PRAZOS
• Abertura de chamado: das 7h às 23h.
• Suporte telefônico: em até 2h dentro da janela de atendimento. Se o prazo ultrapassar as 23h, o saldo de horas é retomado no dia seguinte a partir das 7h.
• Atendimento presencial: em até 24h, de segunda a segunda, salvo justificativa nossa em prol da efetividade (ex.: necessidade de peça ou envio de ferramental).
• Manutenções preventivas e corretivas: agendáveis em horário estendido (7h às 23h, de segunda a segunda) para minimizar a parada de máquina.

PEÇAS E REPAROS
• Dispomos de laboratório de reparo e estoque de peças próprios. O cliente é livre para realizar reparos ou comprar peças com outras empresas.
• Reparo ou Fornecimento de Peças possuem condições diferenciadas e fluxo prioritário para clientes em contrato.

DESPESAS
• Inclusas no contrato: deslocamento terrestre, alimentação e hospedagem.
• Por conta da contratante: envio de ferramental e despesas aéreas — encaminhadas em demonstrativo após o atendimento, com pagamento junto ao contrato do mês seguinte.`;

// Texto padrão por tipo de contrato. Apenas "Mão de Obra - Especial" tem texto
// real; os demais usam um placeholder curto (igual ao backend).
export const CONDICOES_PADRAO: Record<string, string> = {
  "Suporte Remoto": "(condições a definir)",
  "Mão de Obra - Regular": "(condições a definir)",
  "Mão de Obra - Especial": MAO_DE_OBRA_ESPECIAL,
};

export interface EquipamentoProposta {
  id?: string;
  modalidade: string;
  marca: string;
  marcaOutras: string;
  modelo: string;
  numeroSerie: string;
  valorContrato: number; // "Valor do Contrato" (mensal) em reais
}

export interface Proposta {
  id: string;
  // Identificação
  numero: string;
  data: string; // ISO yyyy-mm-dd
  // Cliente
  cnpj: string;
  empresa: string;
  // Endereço
  cep: string;
  endereco: string;
  enderecoNumero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  pais: string;
  // Solicitante
  solicitante: string;
  setor: string;
  telefone: string;
  email: string;
  // Modalidade do contrato e condições
  tipoContrato: string;
  condicoesContrato: string;
  condicoesPadraoSnap: string;
  observacoesInternas: string;
  // Resumo
  descontoPercent: number;
  subtotal: number;
  desconto: number;
  total: number;
  // Finalização
  textoFinal: string;
  // Status (mesmos campos de controle do orçamento)
  enviado: boolean;
  aprovado: boolean;
  realizado: boolean;
  aguardandoPeca: boolean;
  ordemServico: boolean;
  pagamentoRealizado: boolean;
  // Equipamentos cobertos
  equipamentos: EquipamentoProposta[];
}

// ===== Contrato =====
// Documento gerado a partir de uma proposta aprovada. O corpo (cláusulas) é
// editável como texto, uma cláusula/parágrafo por linha.
export interface Contrato {
  id: string;
  numero: string;
  propostaId: string;
  data: string; // ISO yyyy-mm-dd
  conteudoPadraoSnap: string;
  conteudoCustomizado: string;
  enviado: boolean;
  enviadoEm: string | null;
}

// Campos de status booleanos da página de Controle
export const STATUS_FIELDS: { key: keyof Orcamento; label: string }[] = [
  { key: "enviado", label: "Enviado" },
  { key: "aprovado", label: "Aprovado" },
  { key: "realizado", label: "Realizado" },
  { key: "aguardandoPeca", label: "Aguardando peça" },
  { key: "ordemServico", label: "Ordem de serviço" },
  { key: "pagamentoRealizado", label: "Pagamento realizado" },
];
