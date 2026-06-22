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

// Campos de status booleanos da página de Controle
export const STATUS_FIELDS: { key: keyof Orcamento; label: string }[] = [
  { key: "enviado", label: "Enviado" },
  { key: "aprovado", label: "Aprovado" },
  { key: "realizado", label: "Realizado" },
  { key: "aguardandoPeca", label: "Aguardando peça" },
  { key: "ordemServico", label: "Ordem de serviço" },
  { key: "pagamentoRealizado", label: "Pagamento realizado" },
];
