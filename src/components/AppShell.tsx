import type { ReactNode } from "react";
import type { ViewName } from "../types";
import { initials } from "../lib/health";

type Props = {
  view: ViewName;
  onNavigate: (view: ViewName) => void;
  onSignOut: () => void;
  patientName: string;
  patientAvatar: string;
  saveStatus: string;
  children: ReactNode;
};

const navigation: { name: ViewName; label: string; icon: string }[] = [
  { name: "inicio", label: "Início", icon: "⌂" },
  { name: "medicamentos", label: "Medicamentos", icon: "✿" },
  { name: "calendario", label: "Calendário", icon: "▦" },
  { name: "relatorios", label: "Relatórios", icon: "♡" },
  { name: "perfil", label: "Meu perfil", icon: "☼" },
];

export function AppShell({ view, onNavigate, onSignOut, patientName, patientAvatar, saveStatus, children }: Props) {
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <a className="brand" href="#inicio" aria-label="Zelo, início">
          <span className="brand-flower" aria-hidden="true">❋</span>
          <span>Zelo<small>cuidado no seu tempo</small></span>
        </a>
        <nav className="side-nav">
          {navigation.map((item) => (
            <button key={item.name} className={`nav-link ${view === item.name ? "active" : ""}`} onClick={() => onNavigate(item.name)}>
              <span aria-hidden="true">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span aria-hidden="true">🌿</span><p>Um lembrete gentil: cuidar de você também é um compromisso.</p></div>
        <div className="sidebar-footer">Seus dados ficam salvos com segurança na sua conta.</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-flower" aria-hidden="true">❋</span> Zelo</div>
          <p className="today-label">{today}</p>
          <button className="avatar-button" onClick={() => onNavigate("perfil")} aria-label="Abrir meu perfil">
            {patientAvatar ? <img src={patientAvatar} alt="" /> : initials(patientName)}
          </button>
          <button className="sign-out-button" onClick={onSignOut}>Sair</button>
        </header>
        <p className="save-status" role="status" aria-live="polite">{saveStatus}</p>
        {children}
        <footer className="app-footer">Feito com carinho <span aria-hidden="true">♡</span> Seus dados ficam salvos com segurança na sua conta.</footer>
      </main>

      <nav className="mobile-nav" aria-label="Navegação principal para celular">
        {navigation.map((item) => (
          <button key={item.name} className={`nav-link ${view === item.name ? "active" : ""}`} onClick={() => onNavigate(item.name)}>
            <span aria-hidden="true">{item.icon}</span><small>{item.name === "medicamentos" ? "Remédios" : item.name === "calendario" ? "Agenda" : item.name === "relatorios" ? "Resumo" : item.label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
