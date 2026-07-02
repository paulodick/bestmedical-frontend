import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, getToken, API_ENABLED } from "./lib/api";

interface AuthUser {
  id: string;
  nome: string;
  usuario: string;
  email: string;
  perfil: string;
}

interface AuthCtx {
  user: AuthUser | null;
  autenticado: boolean;
  carregando: boolean; // true enquanto reidrata a sessão no boot
  login: (usuario: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Em modo mock (sem API), o app já entra "autenticado" para preservar a demo.
  const [user, setUser] = useState<AuthUser | null>(
    API_ENABLED
      ? null
      : { id: "demo", nome: "Demonstração", usuario: "demo", email: "demo", perfil: "admin" },
  );

  // No modo real, começa carregando se houver token salvo (vamos validá-lo).
  const [carregando, setCarregando] = useState<boolean>(
    API_ENABLED && !!getToken(),
  );

  // Reidratação da sessão: se há token salvo, valida em /auth/me.
  useEffect(() => {
    if (!API_ENABLED) return;
    const token = getToken();
    if (!token) {
      setCarregando(false);
      return;
    }
    let ativo = true;
    api
      .me()
      .then((u) => {
        if (ativo) setUser(u);
      })
      .catch(() => {
        // Token inválido/expirado: limpa e volta ao login.
        setToken(null);
        if (ativo) setUser(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const value: AuthCtx = {
    user,
    autenticado: !!user,
    carregando,
    login: async (usuario, senha) => {
      const r = await api.login(usuario, senha);
      setToken(r.accessToken);
      setUser(r.user);
    },
    logout: () => {
      setToken(null);
      setUser(null);
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth deve estar dentro de AuthProvider");
  return ctx;
}
