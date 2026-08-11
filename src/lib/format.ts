// ===== Utilitários de formatação e máscaras (pt-BR) =====

export const formatBRL = (valor: number): string =>
  (valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });

export const formatDataBR = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Máscara de data dd/mm/aaaa enquanto digita
export const maskDataBR = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n
    .replace(/^(\d{2})(\d)/, "$1/$2")
    .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
};

// Converte dd/mm/aaaa -> ISO yyyy-mm-dd (retorna "" se incompleto/inválido)
export const brParaISO = (br: string): string => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  const dt = new Date(Number(y), Number(mo) - 1, Number(d));
  if (
    dt.getFullYear() !== Number(y) ||
    dt.getMonth() !== Number(mo) - 1 ||
    dt.getDate() !== Number(d)
  )
    return "";
  return `${y}-${mo}-${d}`;
};

// Converte ISO yyyy-mm-dd -> dd/mm/aaaa (vazio se vazio)
export const isoParaBR = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
};

// Interpreta um único campo de "data de pagamento" que aceita tanto uma
// data (em vários formatos comuns) quanto texto livre (ex.: "Antecipado",
// "30 dias", "Ato"). Se o texto for reconhecível como data válida, retorna
// dataPagamento (ISO) com condicaoPagamento null; caso contrário, retorna
// o texto original como condicaoPagamento com dataPagamento null.
export const parseCondicaoPagamento = (
  textoBruto: string,
): { dataPagamento: string | null; condicaoPagamento: string | null } => {
  const texto = (textoBruto || "").trim();
  if (!texto) return { dataPagamento: null, condicaoPagamento: null };

  const validar = (d: number, mo: number, y: number): string | null => {
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
      return null;
    return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };

  // yyyy-mm-dd (ISO)
  let m = texto.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    const iso = validar(Number(m[3]), Number(m[2]), Number(m[1]));
    if (iso) return { dataPagamento: iso, condicaoPagamento: null };
  }

  // dd/mm/aaaa ou dd-mm-aaaa
  m = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) {
    const iso = validar(Number(m[1]), Number(m[2]), Number(m[3]));
    if (iso) return { dataPagamento: iso, condicaoPagamento: null };
  }

  // dd/mm/aa (assume 20aa)
  m = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})$/);
  if (m) {
    const iso = validar(Number(m[1]), Number(m[2]), 2000 + Number(m[3]));
    if (iso) return { dataPagamento: iso, condicaoPagamento: null };
  }

  // dd/mm (assume ano corrente)
  m = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) {
    const anoAtual = new Date().getFullYear();
    const iso = validar(Number(m[1]), Number(m[2]), anoAtual);
    if (iso) return { dataPagamento: iso, condicaoPagamento: null };
  }

  return { dataPagamento: null, condicaoPagamento: texto };
};

// Texto a exibir/editar no campo único de data de pagamento.
export const formatCondicaoPagamentoInput = (
  dataPagamento?: string | null,
  condicaoPagamento?: string | null,
): string => {
  if (dataPagamento) return formatDataBR(dataPagamento);
  return condicaoPagamento || "";
};

export const hojeISO = (): string => {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
};

// Máscara de CNPJ: 00.000.000/0000-00
export const maskCNPJ = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 14);
  return n
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
};

// Máscara de CEP: 00000-000
export const maskCEP = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 8);
  return n.replace(/^(\d{5})(\d)/, "$1-$2");
};

// Máscara de telefone: (00) 00000-0000
export const maskTelefone = (v: string): string => {
  const n = v.replace(/\D/g, "").slice(0, 11);
  if (n.length <= 10) {
    return n
      .replace(/^(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }
  return n
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d)/, "$1-$2");
};

// Máscara monetária BR — recebe string digitada, devolve número em reais
export const parseMoedaInput = (v: string): number => {
  const apenasDigitos = v.replace(/\D/g, "");
  if (!apenasDigitos) return 0;
  return parseInt(apenasDigitos, 10) / 100;
};

// Exibe número como texto de input monetário (sem símbolo R$, só 1.234,56)
export const moedaParaInput = (valor: number): string =>
  (valor || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Subtotal de uma linha
export const subtotalItem = (qtd: number, valor: number): number =>
  (qtd || 0) * (valor || 0);

export const uid = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
