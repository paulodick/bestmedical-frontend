// ===== Cliente HTTP da API real (Best Medical backend) =====
// Se VITE_API_URL não estiver definida, o app continua em modo mock (offline),
// preservando o comportamento de demonstração atual.

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  "",
);

// Indica se o front deve consumir a API real
export const API_ENABLED = !!BASE;

// Token JWT mantido em memória (sem localStorage por causa do sandbox/iframe).
let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
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

  // CEP
  consultarCep: (cep: string) =>
    req<{ cep: string; endereco: string; bairro: string; cidade: string; estado: string }>(
      `/cep/${cep.replace(/\D/g, "")}`,
    ),
};
