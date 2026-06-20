import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { useAuth } from "../auth";
import logoSymbol from "../assets/logo-symbol.png";

export function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(email, senha);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm">
        {/* Marca */}
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src={logoSymbol}
            alt="Best Medical"
            className="h-16 w-auto object-contain"
          />
          <div className="mt-3">
            <div className="text-[18px] font-bold text-text">Best Medical</div>
            <div className="text-[12px] text-text-faint">
              Sistema de Orçamentos
            </div>
          </div>
        </div>

        {/* Formulário */}
        <form
          onSubmit={submit}
          className="rounded-lg border border-border bg-surface p-6 shadow-sm"
        >
          <h1 className="mb-1 text-[16px] font-semibold text-text">Entrar</h1>
          <p className="mb-5 text-[13px] text-text-muted">
            Acesse com suas credenciais.
          </p>

          <div className="space-y-4">
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@bestmedical.com.br"
                autoComplete="username"
                required
              />
            </Field>
            <Field label="Senha">
              <Input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
          </div>

          {erro && (
            <div className="mt-4 rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
              {erro}
            </div>
          )}

          <Button
            type="submit"
            disabled={carregando}
            className="mt-5 w-full"
            icon={
              carregando ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <LogIn size={16} />
              )
            }
          >
            {carregando ? "Entrando…" : "Entrar"}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] text-text-faint">
          Best Medical • Acesso restrito
        </p>
      </div>
    </div>
  );
}
