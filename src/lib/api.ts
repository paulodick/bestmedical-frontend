// ===== Cliente HTTP da API real (Best Medical backend) =====
// Resolução da URL da API:
// 1) Usa VITE_API_URL se estiver definida (ex.: variável no painel do host).
// 2) Em build de PRODUÇÃO sem a variável, usa a URL padrão da API no Render,
//    garantindo que o site publicado já saia conectado à API real.
// 3) Em desenvolvimento local (npm run dev) sem a variável, permanece em modo
//    mock (offline), preservando o comportamento de demonstração.
const API_PADRAO_PROD = "https://bestmedical-api.onrender.com/api/v1";

const urlConfigurada = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
const urlResolvida =
  urlConfigurada && urlConfigurada.length > 0
    ? urlConfigurada
    : import.meta.env.PROD
      ? API_PADRAO_PROD
      : undefined;

const BASE = urlResolvida?.replace(/\/$/, "");

// Indica se o front deve consumir a API real
export const API_ENABLED = !!BASE;

// Token JWT persistido em localStorage para sobreviver a recarregamentos (F5).
// Em ambientes sem localStorage (ex.: sandbox/iframe restrito), faz fallback
// para memória, mantendo o app funcional.
const TOKEN_KEY = "bestmedical_token";

let token: string | null = (() => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
})();

export const setToken = (t: string | null) => {
  token = t;
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* localStorage indisponível: mantém apenas em memória */
  }
};

export const getToken = () => token;

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      msg = body?.message ? String(body.message) : msg;
    } catch {
      /* ignora corpo não-JSON */
    }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface ListaResposta<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const api = {
  // Autenticação
  login: (email: string, senha: string) =>
    req<{ accessToken: string; user: { id: string; nome: string; email: string; perfil: string } }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, senha }) },
    ),
  me: () => req<{ id: string; nome: string; email: string; perfil: string }>("/auth/me"),

  // Orçamentos
  listarOrcamentos: (query = "") =>
    req<ListaResposta<any>>(`/orcamentos${query}`),
  proximoNumero: () => req<{ numero: string }>("/orcamentos/proximo-numero"),
  criarOrcamento: (o: any) =>
    req<any>("/orcamentos", { method: "POST", body: JSON.stringify(o) }),
  atualizarOrcamento: (id: string, o: any) =>
    req<any>(`/orcamentos/${id}`, { method: "PUT", body: JSON.stringify(o) }),
  atualizarStatus: (id: string, patch: any) =>
    req<any>(`/orcamentos/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  enviarOrcamento: (id: string) =>
    req<any>(`/orcamentos/${id}/enviar`, { method: "POST" }),
  removerOrcamento: (id: string) =>
    req<void>(`/orcamentos/${id}`, { method: "DELETE" }),

  // Buscar um orçamento pelo número exato (ORC-2026-0001).
  // Lança erro (404) quando não existe.
  buscarPorNumero: (numero: string) =>
    req<any>(`/orcamentos/por-numero/${encodeURIComponent(numero.trim())}`),

  // Autocompletar dados do cliente pelo CNPJ (empresa, endereço, número,
  // complemento e último solicitante). Retorna null quando o CNPJ ainda
  // não existe — nesse caso o front mantém os campos como estão.
  buscarClientePorCnpj: (cnpj: string) =>
    req<{
      encontrado: boolean;
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
      solicitante: string;
      setor: string;
      telefone: string;
      email: string;
    } | null>(`/clientes/por-cnpj?cnpj=${encodeURIComponent(cnpj.trim())}`),

  // ===== Propostas de Contrato =====
  listarPropostas: (query = "") =>
    req<ListaResposta<any>>(`/propostas${query}`),
  proximoNumeroProposta: () =>
    req<{ numero: string }>("/propostas/proximo-numero"),
  criarProposta: (p: any) =>
    req<any>("/propostas", { method: "POST", body: JSON.stringify(p) }),
  atualizarProposta: (id: string, p: any) =>
    req<any>(`/propostas/${id}`, { method: "PUT", body: JSON.stringify(p) }),
  atualizarStatusProposta: (id: string, patch: any) =>
    req<any>(`/propostas/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  removerProposta: (id: string) =>
    req<void>(`/propostas/${id}`, { method: "DELETE" }),
  // Busca uma proposta pelo número exato (PC-2026-0001). Lança 404 se não existe.
  buscarPropostaPorNumero: (numero: string) =>
    req<any>(`/propostas/por-numero/${encodeURIComponent(numero.trim())}`),
  // Envia a proposta por e-mail ao solicitante (com cópia de controle)
  enviarProposta: (id: string) =>
    req<{ ok: boolean; mensagem: string; proposta?: any }>(
      `/propostas/${id}/enviar`,
      { method: "POST" },
    ),
  // Abre o PDF da proposta gerado pelo servidor numa nova aba (igual abrirPdf)
  abrirPdfProposta: async (id: string) => {
    const res = await fetch(`${BASE}/propostas/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Erro ${res.status} ao gerar o PDF da proposta`;
      try {
        const body = await res.json();
        msg = body?.message ? String(body.message) : msg;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `proposta-${id}.pdf`;
      a.click();
    }
  },

  // Upload do contrato assinado (PDF em base64). Ao carregar, a proposta passa
  // automaticamente para o status "Assinado". Retorna a proposta serializada.
  enviarContratoAssinado: (id: string, arquivoBase64: string, nome: string) =>
    req<any>(`/propostas/${id}/contrato-assinado`, {
      method: "POST",
      body: JSON.stringify({ arquivoBase64, nome }),
    }),
  // Abre o PDF do contrato assinado carregado numa nova aba.
  abrirContratoAssinado: async (id: string) => {
    const res = await fetch(`${BASE}/propostas/${id}/contrato-assinado`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Erro ${res.status} ao abrir o contrato assinado`;
      try {
        const body = await res.json();
        msg = body?.message ? String(body.message) : msg;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-assinado-${id}.pdf`;
      a.click();
    }
  },

  // ===== Follow-ups (acompanhamento comercial) =====
  // Lista os follow-ups de um orçamento OU de uma proposta (decrescente por data).
  listarFollowUps: (params: { orcamentoId?: string; propostaId?: string }) => {
    const qs = new URLSearchParams();
    if (params.orcamentoId) qs.set("orcamentoId", params.orcamentoId);
    if (params.propostaId) qs.set("propostaId", params.propostaId);
    return req<any[]>(`/follow-ups?${qs.toString()}`);
  },
  // Cria um follow-up (autor = usuário logado, definido no servidor).
  criarFollowUp: (payload: {
    orcamentoId?: string;
    propostaId?: string;
    texto: string;
  }) =>
    req<any>("/follow-ups", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // ===== Contratos =====
  // Gera (ou retorna, se já existir) o contrato de uma proposta aprovada.
  gerarContratoDeProposta: (propostaId: string) =>
    req<any>(`/contratos/gerar-de-proposta/${propostaId}`, { method: "POST" }),
  // Busca o contrato vinculado a uma proposta (lança 404 se ainda não existe).
  buscarContratoPorProposta: (propostaId: string) =>
    req<any>(`/contratos/por-proposta/${propostaId}`),
  // Busca o contrato pelo id próprio.
  obterContrato: (id: string) => req<any>(`/contratos/${id}`),
  // Salva o corpo customizado do contrato.
  atualizarContrato: (id: string, dados: any) =>
    req<any>(`/contratos/${id}`, { method: "PUT", body: JSON.stringify(dados) }),
  // Envia o contrato por e-mail ao solicitante (com cópia de controle).
  enviarContrato: (id: string) =>
    req<{ ok: boolean; mensagem: string; contrato?: any }>(
      `/contratos/${id}/enviar`,
      { method: "POST" },
    ),
  // Abre o PDF do contrato gerado pelo servidor numa nova aba.
  abrirPdfContrato: async (id: string) => {
    const res = await fetch(`${BASE}/contratos/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Erro ${res.status} ao gerar o PDF do contrato`;
      try {
        const body = await res.json();
        msg = body?.message ? String(body.message) : msg;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `contrato-${id}.pdf`;
      a.click();
    }
  },

  // ===== CRM (agenda de contatos) =====
  listarContatosCrm: (query = "") =>
    req<ListaResposta<any>>(`/crm/contatos${query}`),
  criarContatoCrm: (c: any) =>
    req<any>("/crm/contatos", { method: "POST", body: JSON.stringify(c) }),
  atualizarContatoCrm: (id: string, c: any) =>
    req<any>(`/crm/contatos/${id}`, { method: "PUT", body: JSON.stringify(c) }),
  removerContatoCrm: (id: string) =>
    req<void>(`/crm/contatos/${id}`, { method: "DELETE" }),
  removerTodosContatosCrm: () =>
    req<{ ok: boolean; removidos: number }>("/crm/contatos", {
      method: "DELETE",
    }),
  importarContatosCrm: (payload: { vcard?: string; contatos?: any[] }) =>
    req<{ importados: number; ignorados: number; total: number }>(
      "/crm/contatos/importar",
      { method: "POST", body: JSON.stringify(payload) },
    ),

  // CEP
  consultarCep: (cep: string) =>
    req<{ cep: string; endereco: string; bairro: string; cidade: string; estado: string }>(
      `/cep/${cep.replace(/\D/g, "")}`,
    ),

  // ===== Ordens de Serviço =====
  // Busca a OS vinculada a um orçamento (lança 404 se ainda não existe)
  buscarOsPorOrcamento: (orcamentoId: string) =>
    req<any>(`/ordens-servico/por-orcamento/${orcamentoId}`),

  // Busca a OS pelo id próprio
  obterOs: (id: string) => req<any>(`/ordens-servico/${id}`),

  // Atualiza os campos editáveis da OS (itens, fotos, assinaturas, textos)
  atualizarOs: (id: string, dados: any) =>
    req<any>(`/ordens-servico/${id}`, {
      method: "PUT",
      body: JSON.stringify(dados),
    }),

  // Envia a OS por e-mail para múltiplos destinatários
  enviarOs: (id: string, destinatarios: string[]) =>
    req<{ ok: boolean; mensagem: string }>(`/ordens-servico/${id}/enviar`, {
      method: "POST",
      body: JSON.stringify({ destinatarios }),
    }),

  // Abre o PDF da OS em nova aba (igual ao abrirPdf do orçamento)
  abrirPdfOs: async (id: string) => {
    const res = await fetch(`${BASE}/ordens-servico/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Erro ${res.status} ao gerar o PDF da OS`;
      try {
        const body = await res.json();
        msg = body?.message ? String(body.message) : msg;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `os-${id}.pdf`;
      a.click();
    }
  },

  // Abre o PDF do orçamento gerado pelo servidor numa nova aba.
  // O endpoint exige autenticação (Bearer), por isso buscamos com o token,
  // criamos um Blob local e abrimos a URL temporária — assim funciona mesmo
  // com a rota protegida.
  abrirPdf: async (id: string) => {
    const res = await fetch(`${BASE}/orcamentos/${id}/pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let msg = `Erro ${res.status} ao gerar o PDF`;
      try {
        const body = await res.json();
        msg = body?.message ? String(body.message) : msg;
      } catch {
        /* corpo não-JSON */
      }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    // Libera a URL temporária após a aba abrir (sem cortar o carregamento).
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    if (!win) {
      // Bloqueio de pop-up: faz download como alternativa.
      const a = document.createElement("a");
      a.href = url;
      a.download = `orcamento-${id}.pdf`;
      a.click();
    }
  },
};
