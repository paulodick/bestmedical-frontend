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
