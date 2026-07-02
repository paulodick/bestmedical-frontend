import { useEffect, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, LogIn } from "lucide-react";
import { Button, Field, Input } from "../components/ui";
import { Modal } from "../components/Modal";
import { useAuth } from "../auth";
import { api, API_ENABLED } from "../lib/api";
import logoSymbol from "../assets/logo-symbol.png";

export function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // Estado do modal "Alterar senha".
  const [modalSenha, setModalSenha] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      await login(usuario, senha);
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
            <Field label="Usuário">
              <Input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ex: paulodick"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
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

          {/* Link para abrir o modal de troca de senha */}
          <button
            type="button"
            onClick={() => setModalSenha(true)}
            className="mt-4 flex w-full items-center justify-center gap-1.5 text-[13px] font-medium text-primary transition-colors hover:text-primary/80"
          >
            <KeyRound size={14} />
            Alterar senha
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-text-faint">
          Best Medical • Acesso restrito
        </p>
      </div>

      <AlterarSenhaModal
        open={modalSenha}
        onClose={() => setModalSenha(false)}
        usuarioInicial={usuario}
      />
    </div>
  );
}

// ===== Modal de troca de senha (tela de login, sem sessão) =====
function AlterarSenhaModal({
  open,
  onClose,
  usuarioInicial,
}: {
  open: boolean;
  onClose: () => void;
  usuarioInicial: string;
}) {
  const [usuario, setUsuario] = useState(usuarioInicial);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Reinicia o formulário sempre que abre, herdando o e-mail já digitado no login.
  useEffect(() => {
    if (open) {
      setUsuario(usuarioInicial);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
      setErro(null);
      setSucesso(false);
    }
  }, [open, usuarioInicial]);

  const fechar = () => {
    onClose();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (!API_ENABLED) {
      setErro("Recurso indisponível no modo de demonstração.");
      return;
    }
    if (novaSenha.length < 6) {
      setErro("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (novaSenha !== confirmar) {
      setErro("A confirmação não coincide com a nova senha.");
      return;
    }
    setSalvando(true);
    try {
      await api.alterarSenha(usuario.trim(), senhaAtual, novaSenha);
      setSucesso(true);
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmar("");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Falha ao alterar a senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={fechar}
      title="Alterar senha"
      footer={
        sucesso ? (
          <Button onClick={fechar}>Concluir</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={fechar} type="button">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="form-alterar-senha"
              disabled={salvando}
              icon={
                salvando ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <KeyRound size={16} />
                )
              }
            >
              {salvando ? "Salvando…" : "Salvar nova senha"}
            </Button>
          </>
        )
      }
    >
      <div className="p-5">
        {sucesso ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CheckCircle2 size={40} className="text-success" />
            <div>
              <div className="text-[15px] font-semibold text-text">
                Senha alterada com sucesso
              </div>
              <p className="mt-1 text-[13px] text-text-muted">
                Use a nova senha para entrar no sistema.
              </p>
            </div>
          </div>
        ) : (
          <form id="form-alterar-senha" onSubmit={submit} className="space-y-4">
            <p className="text-[13px] text-text-muted">
              Informe seu usuário e a senha atual para definir uma nova senha.
            </p>
            <Field label="Usuário">
              <Input
                type="text"
                value={usuario}
                onChange={(e) => setUsuario(e.target.value)}
                placeholder="ex: paulodick"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </Field>
            <Field label="Senha atual">
              <Input
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field label="Nova senha">
              <Input
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo de 6 caracteres"
                autoComplete="new-password"
                required
              />
            </Field>
            <Field label="Confirmar nova senha">
              <Input
                type="password"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
                placeholder="Repita a nova senha"
                autoComplete="new-password"
                required
              />
            </Field>

            {erro && (
              <div className="rounded-md bg-danger-soft px-3 py-2 text-[13px] text-danger">
                {erro}
              </div>
            )}
          </form>
        )}
      </div>
    </Modal>
  );
}
