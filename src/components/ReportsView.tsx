import type { Appointment, HealthLog, Medication } from "../types";
import { addDays, formatDate, parseDate, todayKey } from "../lib/health";

type Props = { medications: Medication[]; appointments: Appointment[]; logs: HealthLog[] };

export function ReportsView({ medications, appointments, logs }: Props) {
  const end = new Date();
  const start = addDays(end, -6);
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(start, index);
    const key = todayKey(date);
    const active = medications.filter((medication) => key >= (medication.startDate || key) && (!medication.treatmentEnd || key <= medication.treatmentEnd));
    const expected = active.reduce((total, medication) => total + medication.times.length, 0);
    const taken = logs.filter((log) => log.type === "dose" && log.date === key).length;
    return { date, key, expected, taken };
  });
  const expected = week.reduce((total, day) => total + day.expected, 0);
  const taken = week.reduce((total, day) => total + day.taken, 0);
  const percent = expected ? Math.round(Math.min(1, taken / expected) * 100) : 0;
  const peak = Math.max(1, ...week.map((day) => day.expected));
  const entries = [
    ...logs.filter((log) => log.type === "refill").map((log) => ({ id: log.id, date: log.date, title: `Reposição: ${log.medName}`, detail: `+${log.amount} ${log.unit}`, type: "refill" })),
    ...appointments.map((appointment) => ({ id: appointment.id, date: appointment.date, title: appointment.title, detail: appointment.time || "Consulta", type: "appointment" })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  return (
    <section className="view" aria-labelledby="reports-title">
      <div className="page-heading"><div><p className="eyebrow">CADA CUIDADO CONTA</p><h1 id="reports-title">Seu acompanhamento</h1><p className="subheading">Um resumo gentil da sua rotina nesta semana.</p></div></div>
      <div className="reports-grid">
        <section className="card adherence-card">
          <p className="eyebrow">ÚLTIMOS 7 DIAS</p><h2>Adesão aos horários</h2>
          <div className="adherence-score"><strong>{percent}%</strong><span>das doses registradas</span></div>
          <div className="progress-track"><div style={{ width: `${percent}%` }} /></div>
          <p className="muted">{expected ? `${taken} de ${expected} horários marcados entre ${formatDate(todayKey(start))} e ${formatDate(todayKey(end))}.` : "Cadastre horários para ver seu acompanhamento semanal."}</p>
          <div className="weekly-chart" aria-label="Doses tomadas por dia">
            {week.map((day) => {
              const label = new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(day.date).replace(".", "");
              const height = day.expected ? Math.max(7, day.taken / peak * 94) : 4;
              return <div className={`chart-day ${day.key === todayKey() ? "today-chart" : ""}`} title={`${day.taken} de ${day.expected} doses`} key={day.key}><div className="chart-bar-track"><div className="chart-bar" style={{ height: `${height}%` }} /></div><span>{label}</span></div>;
            })}
          </div>
        </section>
        <section className="card"><p className="eyebrow">HISTÓRICO RECENTE</p><h2>Reposições e consultas</h2>
          {entries.length ? entries.map((entry) => {
            const date = parseDate(entry.date);
            const month = new Intl.DateTimeFormat("pt-BR", { month: "short" }).format(date).replace(".", "");
            return <div className="history-item" key={`${entry.type}-${entry.id}`}><div className="date-tile"><strong>{date.getDate()}</strong><span>{month}</span></div><div><div className="appointment-title">{entry.type === "refill" ? "✿ " : "♡ "}{entry.title}</div><div className="appointment-detail">{entry.detail}</div></div></div>;
          }) : <div className="empty-state"><p>Suas reposições e consultas salvas aparecerão aqui.</p></div>}
        </section>
      </div>
    </section>
  );
}
