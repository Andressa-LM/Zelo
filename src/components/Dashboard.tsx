import { useEffect, useState } from "react";
import type { Appointment, HealthLog, Medication, Patient } from "../types";
import {
  depletionFor,
  formatDate,
  greetingFor,
  hasTaken,
  todayKey,
  whatsappUrl,
} from "../lib/health";

type Props = {
  patient: Patient;
  medications: Medication[];
  appointments: Appointment[];
  logs: HealthLog[];
  onAddMedication: () => void;
  onAddAppointment: () => void;
  onToggleDose: (medication: Medication, time: string) => void;
};

function AppointmentItem({ appointment }: { appointment: Appointment }) {
  const date = new Date(`${appointment.date}T12:00:00`);
  const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
  return (
    <div className="appointment-item">
      <div className="date-tile"><strong>{date.getDate()}</strong><span>{month}</span></div>
      <div><div className="appointment-title">{appointment.title}</div><div className="appointment-detail">{appointment.time || "Horário a combinar"}{appointment.notes ? ` · ${appointment.notes}` : ""}</div></div>
    </div>
  );
}

export function Dashboard({ patient, medications, appointments, logs, onAddMedication, onAddAppointment, onToggleDose }: Props) {
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const greeting = greetingFor(patient);
  const today = todayKey();
  const nextAppointment = appointments.filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const dueCount = medications.reduce(
    (total, medication) => total + medication.times.filter((time) => !hasTaken(logs, medication.id, today, time)).length,
    0,
  );
  const warnings = medications
    .map((medication) => ({ medication, depletion: depletionFor(medication) }))
    .filter(({ depletion }) => depletion.days <= 3)
    .sort((a, b) => a.depletion.days - b.depletion.days);
  const upcoming = appointments
    .filter((appointment) => appointment.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .slice(0, 4);
  const doses = medications
    .flatMap((medication) => medication.times.map((time) => ({ medication, time })))
    .sort((a, b) => a.time.localeCompare(b.time));

  useEffect(() => {
    if (notificationPermission !== "granted" || !("Notification" in window)) return;
    const sent = new Set<string>();
    const check = () => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const date = todayKey(now);
      medications.forEach((medication) => {
        const key = `${date}:${medication.id}:${currentTime}`;
        if (!medication.times.includes(currentTime) || hasTaken(logs, medication.id, date, currentTime) || sent.has(key)) return;
        sent.add(key);
        const notification = new Notification(`Hora de cuidar de você: ${medication.name}`, {
          body: `${medication.dose} · ${currentTime}`,
          tag: key,
        });
        notification.onclick = () => window.focus();
      });
    };
    check();
    const interval = window.setInterval(check, 15_000);
    return () => window.clearInterval(interval);
  }, [logs, medications, notificationPermission]);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(await Notification.requestPermission());
  }

  return (
    <section className="view" aria-labelledby="welcome-title">
      <div className="welcome-row">
        <div><p className="eyebrow">SEU CANTINHO DE CUIDADO</p><h1 id="welcome-title"><span>{greeting.message}</span> <span aria-hidden="true">🌼</span></h1><p className="subheading">{greeting.caption}</p></div>
        <button className="button button-primary" onClick={onAddMedication}>＋ Novo medicamento</button>
      </div>

      {warnings.map(({ medication, depletion }) => (
        <div className="notice notice-warning" key={medication.id}>
          <strong>Um lembrete para você:</strong> o estoque de {medication.name} pode terminar {depletion.days === 0 ? "hoje" : `em ${depletion.days} dia${depletion.days === 1 ? "" : "s"}`}.
          {" "}<a href={whatsappUrl(patient.name, medication)} target="_blank" rel="noopener noreferrer" className="text-button">Preparar lembrete no WhatsApp ↗</a>
        </div>
      ))}

      {notificationPermission === "default" && (
        <div className="notice notice-success">Quer receber lembretes no horário cadastrado? <button className="text-button" onClick={() => void enableNotifications()}>Ativar lembretes</button><span className="muted"> Funcionam enquanto esta página estiver aberta.</span></div>
      )}
      {notificationPermission === "granted" && <div className="notice notice-success">Lembretes ativados neste navegador. Funcionam enquanto esta página estiver aberta.</div>}
      {notificationPermission === "denied" && <div className="notice notice-warning">Notificações bloqueadas pelo navegador. Você ainda pode acompanhar os horários nesta tela.</div>}
      {notificationPermission === "unsupported" && <div className="notice notice-warning">Este navegador não oferece notificações. Deixe a tela de medicamentos aberta para acompanhar os horários.</div>}

      <div className="stats-grid">
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">✿</span><span><strong className="stat-value">{medications.length}</strong><span className="stat-label">medicamentos ativos</span></span></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">♡</span><span><strong className="stat-value">{dueCount}</strong><span className="stat-label">horários ainda para hoje</span></span></article>
        <article className="stat-card"><span className="stat-icon" aria-hidden="true">☼</span><span><strong className="stat-value">{nextAppointment ? formatDate(nextAppointment.date, { day: "numeric", month: "short" }) : "—"}</strong><span className="stat-label">próxima consulta</span></span></article>
      </div>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading"><div><p className="eyebrow">UM DIA DE CADA VEZ</p><h2>Seus medicamentos</h2></div></div>
          {doses.length ? doses.map(({ medication, time }) => {
            const taken = hasTaken(logs, medication.id, today, time);
            return (
              <div className="medication-row" key={`${medication.id}-${time}`}>
                <div className="med-icon">{medication.image ? <img src={medication.image} alt="" loading="lazy" /> : "✿"}</div>
                <div className="med-info"><h3>{medication.name}</h3><p>{time} · {medication.dose} · Estoque: {medication.quantity} {medication.unit}</p></div>
                <div className="dose-actions"><button className={`dose-button ${taken ? "taken" : ""}`} disabled={!taken && medication.quantity < medication.unitsPerDose} onClick={() => onToggleDose(medication, time)}>{taken ? "✓ Tomado" : "Marcar"}</button></div>
              </div>
            );
          }) : <div className="empty-state"><span className="empty-flower">🌼</span><p>Adicione um medicamento para acompanhar seus horários de hoje.</p></div>}
        </section>
        <section className="card">
          <div className="section-heading"><div><p className="eyebrow">COM CARINHO, POR VOCÊ</p><h2>Próximos encontros</h2></div><button className="icon-button" onClick={onAddAppointment} aria-label="Agendar consulta">＋</button></div>
          {upcoming.length ? upcoming.map((appointment) => <AppointmentItem key={appointment.id} appointment={appointment} />) : <div className="empty-state"><span className="empty-flower">☼</span><p>Seu espaço para consultas futuras está esperando por você.</p><button className="text-button" onClick={onAddAppointment}>Agendar consulta +</button></div>}
        </section>
      </div>
    </section>
  );
}
