import { useState, type FormEvent } from "react";
import type { AuthMode } from "../types";

type Props = {
  configured: boolean;
  googleEnabled: boolean;
  busy: boolean;
  initialMessage?: string;
  onLogin: (email: string, password: string) => Promise<void>;
  onSignup: (name: string, email: string, password: string) => Promise<void>;
  onGoogle: () => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
  onResendConfirmation: (email: string) => Promise<void>;
};

export function AuthScreen({
  configured,
  googleEnabled,
  busy,
  initialMessage = "",
  onLogin,
  onSignup,
  onGoogle,
  onResetPassword,
  onResendConfirmation,
}: Props) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [message, setMessage] = useState(initialMessage);
  const [error, setError] = useState(Boolean(initialMessage));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      if (mode === "signup") await onSignup(name.trim(), email.trim(), password);
      else await onLogin(email.trim(), password);
      setMessage(
        mode === "signup"
          ? "Cadastro iniciado. Confirme seu endereço de e-mail para entrar."
          : "Acesso realizado.",
      );
      setError(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível concluir o acesso.");
      setError(true);
    }
  }

  async function resetPassword() {
    setMessage("");
    try {
      await onResetPassword(email.trim());
      setMessage("Se esse endereço estiver cadastrado, você receberá um e-mail para redefinir a senha.");
      setError(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível solicitar a redefinição.");
      setError(true);
    }
  }

  async function resendConfirmation() {
    setMessage("");
    try {
      await onResendConfirmation(email.trim());
      setMessage("Se esse endereço tiver um cadastro pendente, enviaremos um novo link de confirmação.");
      setError(false);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível reenviar a confirmação.");
      setError(true);
    }
  }

  async function googleLogin() {
    setMessage("");
    try {
      await onGoogle();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível iniciar o login Google.");
      setError(true);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
  }

  return (
    <section className="auth-screen" aria-labelledby="auth-title">
      <div className="auth-card">
        <a className="brand auth-brand" href="#" aria-label="Zelo">
          <img className="brand-logo" src="/zelo-logo.png" alt="Zelo — cuidado que organiza" />
        </a>
        <p className="eyebrow">SEU CANTINHO DE CUIDADO</p>
        <h1 id="auth-title">Entre no seu espaço de cuidado</h1>
        <p className="subheading">Acesse com segurança para encontrar seus dados em seus dispositivos.</p>
        {!configured && (
          <div className="notice notice-warning" role="status">
            Configure as variáveis do Supabase em <code>.env.local</code> e siga as instruções do README.
          </div>
        )}
        {(initialMessage || message) && (
          <div className={`notice ${initialMessage || error ? "notice-error" : "notice-success"}`} role="status" aria-live="polite">
            {initialMessage || message}
          </div>
        )}
        <button
          className="button button-google"
          type="button"
          disabled={!configured || !googleEnabled || busy}
          onClick={() => void googleLogin()}
        >
          <span className="google-g" aria-hidden="true">G</span>
          {googleEnabled ? "Continuar com Google" : "Login Google ainda não configurado"}
        </button>
        <div className="auth-divider"><span>ou use seu e-mail</span></div>
        <div className="auth-tabs" role="group" aria-label="Tipo de acesso">
          <button className={`auth-tab ${mode === "login" ? "active" : ""}`} type="button" onClick={() => changeMode("login")}>Entrar</button>
          <button className={`auth-tab ${mode === "signup" ? "active" : ""}`} type="button" onClick={() => changeMode("signup")}>Criar conta</button>
        </div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          {mode === "signup" && (
            <label className="field">
              Como podemos chamar você?
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={100} required placeholder="Seu nome" />
            </label>
          )}
          <label className="field">
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required placeholder="voce@exemplo.com" disabled={!configured} />
          </label>
          <label className="field">
            Senha
            <span className="password-input-wrap">
              <input value={password} onChange={(event) => setPassword(event.target.value)} type={passwordVisible ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={mode === "signup" ? 8 : undefined} required placeholder="Pelo menos 8 caracteres" disabled={!configured} />
              <button
                className="password-visibility"
                type="button"
                aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={passwordVisible}
                onClick={() => setPasswordVisible((visible) => !visible)}
              >
                {passwordVisible ? "Ocultar" : "Mostrar"}
              </button>
            </span>
          </label>
          <button className="button button-primary auth-submit" type="submit" disabled={!configured || busy}>
            {busy ? "Aguarde…" : mode === "signup" ? "Criar minha conta" : "Entrar"}
          </button>
        </form>
        {mode === "login" && (
          <button className="text-button auth-reset" type="button" disabled={!configured || busy} onClick={() => void resetPassword()}>
            Esqueci minha senha
          </button>
        )}
        {mode === "signup" && (
          <button className="text-button auth-reset" type="button" disabled={!configured || busy} onClick={() => void resendConfirmation()}>
            Reenviar confirmação de e-mail
          </button>
        )}
        <p className="auth-privacy">Seus dados de saúde são armazenados na sua conta e protegidos por regras individuais de acesso.</p>
      </div>
      <p className="auth-footnote">Zelo não substitui orientação de profissionais de saúde.</p>
    </section>
  );
}
