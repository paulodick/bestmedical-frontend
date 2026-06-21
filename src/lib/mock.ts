import type { Orcamento } from "../types";
import { uid } from "./format";
import { api, API_ENABLED } from "./api";

// ===== Base fictícia de CEPs para simular preenchimento automático =====
export interface EnderecoMock {
  endereco: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export const CEP_DB: Record<string, EnderecoMock> = {
  "01310-100": {
    endereco: "Av. Paulista, 1578",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
  },
  "04538-133": {
    endereco: "Av. Brigadeiro Faria Lima, 3477",
    bairro: "Itaim Bibi",
    cidade: "São Paulo",
    estado: "SP",
  },
  "20040-020": {
    endereco: "Av. Rio Branco, 156",
    bairro: "Centro",
    cidade: "Rio de Janeiro",
    estado: "RJ",
  },
  "30130-009": {
    endereco: "Av. Afonso Pena, 1500",
    bairro: "Centro",
    cidade: "Belo Horizonte",
    estado: "MG",
  },
  "80060-000": {
    endereco: "R. Marechal Deodoro, 630",
    bairro: "Centro",
    cidade: "Curitiba",
    estado: "PR",
  },
  "90010-150": {
    endereco: "R. dos Andradas, 1234",
    bairro: "Centro Histórico",
    cidade: "Porto Alegre",
    estado: "RS",
  },
};

// Simula a consulta de um CEP (retorna após pequeno atraso, como uma API)
// Consulta de CEP. Em modo real, usa a API (ViaCEP via backend);
// em modo mock, usa a base fictícia. Mesma assinatura — a UI não muda.
export const consultarCEP = async (
  cep: string,
): Promise<EnderecoMock | null> => {
  if (API_ENABLED) {
    try {
      const r = await api.consultarCep(cep);
      return {
        endereco: r.endereco,
        bairro: r.bairro,
        cidade: r.cidade,
        estado: r.estado,
      };
    } catch {
      return null;
    }
  }
  // modo mock
  return new Promise((resolve) => {
    setTimeout(() => resolve(CEP_DB[cep] ?? null), 600);
  });
};

export const ESTADOS_BR = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

// ===== Próximo número de orçamento automático =====
export const proximoNumero = (existentes: Orcamento[]): string => {
  const ano = new Date().getFullYear();
  const doAno = existentes
    .map((o) => o.numero)
    .filter((n) => n.startsWith(`ORC-${ano}-`))
    .map((n) => parseInt(n.split("-")[2] || "0", 10))
    .filter((n) => !isNaN(n));
  const max = doAno.length ? Math.max(...doAno) : 0;
  return `ORC-${ano}-${String(max + 1).padStart(4, "0")}`;
};

// ===== Orçamentos fictícios (seed) =====
// Seeds sem os campos de parcelamento e sem número/complemento de endereço
// — todos preenchidos em runtime pelo store (normalizar()).
export type OrcamentoSeed = Omit<
  Orcamento,
  "numParcelas" | "parcelas" | "enderecoNumero" | "complemento"
>;

export const SEED_ORCAMENTOS: OrcamentoSeed[] = [
  {
    id: uid(),
    numero: "ORC-2026-0001",
    data: "2026-01-14",
    cnpj: "12.345.678/0001-90",
    empresa: "Hospital Santa Clara",
    cep: "01310-100",
    endereco: "Av. Paulista, 1578",
    bairro: "Bela Vista",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",
    solicitante: "Dra. Helena Martins",
    setor: "Diagnóstico por Imagem",
    telefone: "(11) 98765-4321",
    email: "helena.martins@santaclara.com.br",
    modalidade: "Ressonância Magnética",
    marca: "Siemens",
    marcaOutras: "",
    modelo: "MAGNETOM Aera 1.5T",
    numeroSerie: "SN-MR-44821",
    descricaoVisita:
      "Substituição de bobina de superfície com falha intermitente de sinal.",
    itens: [
      { id: uid(), codigo: "BOB-1521", item: "Bobina de coluna 1.5T", quantidade: 1, valorItem: 18500 },
      { id: uid(), codigo: "MO-HORA", item: "Mão de obra técnica especializada", quantidade: 4, valorItem: 480 },
    ],
    descontoPercent: 5,
    observacoes: "Necessário agendamento prévio com a equipe de física médica.",
    textoFinal:
      "Orçamento válido por 15 dias. Inclui deslocamento e visita técnica em loco.",
    enviado: true,
    aprovado: true,
    realizado: false,
    aguardandoPeca: true,
    ordemServico: true,
    pagamentoRealizado: false,
  },
  {
    id: uid(),
    numero: "ORC-2026-0002",
    data: "2026-02-03",
    cnpj: "98.765.432/0001-10",
    empresa: "Clínica Imagem Diagnóstica",
    cep: "04538-133",
    endereco: "Av. Brigadeiro Faria Lima, 3477",
    bairro: "Itaim Bibi",
    cidade: "São Paulo",
    estado: "SP",
    pais: "Brasil",
    solicitante: "Eng. Roberto Lima",
    setor: "Engenharia Clínica",
    telefone: "(11) 91234-5678",
    email: "roberto.lima@imagemdiag.com.br",
    modalidade: "Tomografia",
    marca: "GE",
    marcaOutras: "",
    modelo: "Revolution CT",
    numeroSerie: "SN-CT-77310",
    descricaoVisita:
      "Manutenção preventiva anual e calibração do gantry.",
    itens: [
      { id: uid(), codigo: "MP-ANUAL", item: "Pacote manutenção preventiva anual", quantidade: 1, valorItem: 9800 },
    ],
    descontoPercent: 0,
    observacoes: "",
    textoFinal: "Orçamento válido por 30 dias.",
    enviado: true,
    aprovado: false,
    realizado: false,
    aguardandoPeca: false,
    ordemServico: false,
    pagamentoRealizado: false,
  },
  {
    id: uid(),
    numero: "ORC-2026-0003",
    data: "2026-03-22",
    cnpj: "45.678.901/0001-22",
    empresa: "Instituto do Coração de BH",
    cep: "30130-009",
    endereco: "Av. Afonso Pena, 1500",
    bairro: "Centro",
    cidade: "Belo Horizonte",
    estado: "MG",
    pais: "Brasil",
    solicitante: "Dr. Anderson Costa",
    setor: "Hemodinâmica",
    telefone: "(31) 99876-1122",
    email: "anderson.costa@incorbh.com.br",
    modalidade: "Hemodinâmica",
    marca: "Philips",
    marcaOutras: "",
    modelo: "Azurion 7",
    numeroSerie: "SN-HEM-20455",
    descricaoVisita:
      "Troca de detector plano com perda de qualidade de imagem.",
    itens: [
      { id: uid(), codigo: "DET-PLN", item: "Detector plano 30x40", quantidade: 1, valorItem: 124000 },
      { id: uid(), codigo: "MO-HORA", item: "Mão de obra técnica especializada", quantidade: 8, valorItem: 520 },
    ],
    descontoPercent: 8,
    observacoes: "Equipamento crítico — priorizar atendimento.",
    textoFinal: "Inclui garantia de 90 dias sobre a peça substituída.",
    enviado: true,
    aprovado: true,
    realizado: true,
    aguardandoPeca: false,
    ordemServico: true,
    pagamentoRealizado: true,
  },
  {
    id: uid(),
    numero: "ORC-2026-0004",
    data: "2026-05-10",
    cnpj: "33.222.111/0001-55",
    empresa: "Centro de Diagnóstico Curitiba",
    cep: "80060-000",
    endereco: "R. Marechal Deodoro, 630",
    bairro: "Centro",
    cidade: "Curitiba",
    estado: "PR",
    pais: "Brasil",
    solicitante: "Marcela Souza",
    setor: "Administração",
    telefone: "(41) 98123-4455",
    email: "marcela.souza@cdcuritiba.com.br",
    modalidade: "Mamografia",
    marca: "Hologic",
    marcaOutras: "Hologic",
    modelo: "Selenia Dimensions",
    numeroSerie: "SN-MAMO-66120",
    descricaoVisita:
      "Avaliação técnica de paddle de compressão danificado.",
    itens: [
      { id: uid(), codigo: "PAD-24", item: "Paddle de compressão 24x29", quantidade: 1, valorItem: 7400 },
    ],
    descontoPercent: 0,
    observacoes: "",
    textoFinal: "Orçamento sujeito a confirmação de disponibilidade da peça.",
    enviado: false,
    aprovado: false,
    realizado: false,
    aguardandoPeca: false,
    ordemServico: false,
    pagamentoRealizado: false,
  },
  {
    id: uid(),
    numero: "ORC-2026-0005",
    data: "2026-06-15",
    cnpj: "77.888.999/0001-33",
    empresa: "Hospital Universitário POA",
    cep: "90010-150",
    endereco: "R. dos Andradas, 1234",
    bairro: "Centro Histórico",
    cidade: "Porto Alegre",
    estado: "RS",
    pais: "Brasil",
    solicitante: "Eng. Patrícia Nunes",
    setor: "Engenharia Clínica",
    telefone: "(51) 99654-7788",
    email: "patricia.nunes@hupoa.edu.br",
    modalidade: "Ultrassom",
    marca: "Canon",
    marcaOutras: "",
    modelo: "Aplio i800",
    numeroSerie: "SN-US-88241",
    descricaoVisita:
      "Reparo de transdutor convexo com elementos inativos.",
    itens: [
      { id: uid(), codigo: "TRD-CVX", item: "Transdutor convexo PVT-375BT", quantidade: 1, valorItem: 32500 },
      { id: uid(), codigo: "MO-HORA", item: "Mão de obra técnica especializada", quantidade: 2, valorItem: 480 },
    ],
    descontoPercent: 3,
    observacoes: "Cliente solicitou nota fiscal com empenho.",
    textoFinal: "Orçamento válido por 20 dias.",
    enviado: true,
    aprovado: false,
    realizado: false,
    aguardandoPeca: true,
    ordemServico: false,
    pagamentoRealizado: false,
  },
];
