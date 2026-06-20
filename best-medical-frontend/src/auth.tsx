import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { api, setToken, API_ENABLED } from "./lib/api";

interface AuthUser {
  id: string;
  nome: string;
  email: string;
  perfil: string;
}

interface AuthCtx {
  user: AuthUser | null;
  autenticado: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Em modo mock (sem API), o app já entra "autenticado" para preservar a demo.
  const [user, setUser] = useState<AuthUser | null>(
    API_ENABLED
      ? null
      : { id: "demo", nome: "Demonstração", email: "demo", perfil: "admin" },
  );

  const value: AuthCtx = {
    user,
    autenticado: !!user,
    login: async (email, senha) => {
      const r = await api.login(email, senha);
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
