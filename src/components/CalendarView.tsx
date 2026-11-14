import type { Appointment, Medication } from "../types";
import { addDays, depletionFor, formatDate, todayKey } from "../lib/health";

type Props = {
  appointments: Appointment[];
  medications: Medication[];
  selectedDate: string;
  visibleMonth: Date;
  onSelectDate: (date: string) => void;
  onChangeMonth: (month: Date) => void;
  onAddAppointment: (date: string) => void;
  onEditAppointment: (appointment: Appointment) => void;
  onDeleteAppointment: (appointment: Appointment) => void;
  onAddMedication: (date: string) => void;
  onEditMedication: (medication: Medication) => void;
};

export function CalendarView({
  appointments,
  medications,
  selectedDate,
  visibleMonth,
  onSelectDate,
  onChangeMonth,
  onAddAppointment,
  onEditAppointment,
  onDeleteAppointment,
  onAddMedication,
  onEditMedication,
}: Props) {
  const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const start = addDays(first, -((first.getDay() + 6) % 7));
  const dates = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const events = new Map<string, { type: "appointment" | "medication" | "refill"; appointment?: Appointment; medication?: Medication }[]>();
  const addEvent = (date: string, event: { type: "appointment" | "medication" | "refill"; appointment?: Appointment; medication?: Medication }) => {
    const current = events.get(date) ?? [];
    current.push(event);
    events.set(date, current);
  };
  appointments.forEach((appointment) => addEvent(appointment.date, { type: "appointment", appointment }));
  medications.forEach((medication) => {
    addEvent(medication.startDate || todayKey(), { type: "medication", medication });
    addEvent(depletionFor(medication).date, { type: "refill", medication });
  });
  const selectedAppointments = appointments.filter((appointment) => appointment.date === selectedDate);
  const activeMedications = medications.filter((medication) => selectedDate >= (medication.startDate || todayKey()) && (!medication.treatmentEnd || selectedDate <= medication.treatmentEnd));
  const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

  return (
    <section className="view" aria-labelledby="calendar-title">
      <div className="page-heading"><div><p className="eyebrow">UM OLHAR PARA FRENTE</p><h1 id="calendar-title">Calendário do cuidado</h1><p className="subheading">Selecione um dia para consultar, criar ou editar eventos.</p></div></div>
      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="calendar-toolbar"><button className="icon-button" aria-label="Mês anterior" onClick={() => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>‹</button><h2>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(visibleMonth)}</h2><button className="icon-button" aria-label="Próximo mês" onClick={() => onChangeMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>›</button></div>
          <div className="calendar-grid" role="grid" aria-label="Calendário do mês">
            {weekdays.map((day) => <div className="calendar-weekday" role="columnheader" key={day}>{day}</div>)}
            {dates.map((date) => {
              const key = todayKey(date);
              const dayEvents = events.get(key) ?? [];
              const types = [...new Set(dayEvents.map((event) => event.type))];
              return (
                <button key={key} className={`calendar-day ${date.getMonth() !== visibleMonth.getMonth() ? "other-month" : ""} ${key === todayKey() ? "today" : ""} ${key === selectedDate ? "selected" : ""}`} role="gridcell" aria-label={`${formatDate(key, { weekday: "long", day: "numeric", month: "long" })}${dayEvents.length ? `, ${dayEvents.length} evento(s)` : ""}`} aria-pressed={key === selectedDate} onClick={() => onSelectDate(key)}>
                  <span>{date.getDate()}</span>
                  <span className="day-dots">{types.map((type) => <i key={type} className={`day-dot ${type === "appointment" ? "appointment-dot" : type === "medication" ? "medication-dot" : "refill-dot"}`} />)}</span>
                </button>
              );
            })}
          </div>
          <div className="calendar-legend"><span><i className="legend-dot appointment-dot" />Consulta</span><span><i className="legend-dot medication-dot" />Início do tratamento</span><span><i className="legend-dot refill-dot" />Repor medicamento</span></div>
        </section>
        <section className="card agenda-card">
          <p className="eyebrow">SEUS COMPROMISSOS</p><h2>Agenda</h2>
          <p className="agenda-date">{formatDate(selectedDate, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          {selectedAppointments.map((appointment) => (
            <div className="agenda-event appointment-event" key={appointment.id}>
              <strong>♡ {appointment.title}</strong>{appointment.time || "Horário a combinar"}{appointment.notes ? ` · ${appointment.notes}` : ""}
              <div className="agenda-actions"><button className="text-button" onClick={() => onEditAppointment(appointment)}>Editar consulta</button><button className="text-button" onClick={() => onDeleteAppointment(appointment)}>Remover</button></div>
            </div>
          ))}
          {activeMedications.length ? <section className="agenda-medications"><p className="eyebrow">MEDICAMENTOS EM TRATAMENTO</p>{activeMedications.map((medication) => <div className="agenda-medication-row" key={medication.id}><span><strong>{medication.name}</strong><small>{medication.dose} · {medication.times.join(", ")}</small></span><button className="text-button" onClick={() => onEditMedication(medication)}>Editar</button></div>)}</section> : <p className="muted">Nenhum medicamento cadastrado para esta data.</p>}
          {medications.filter((medication) => depletionFor(medication).date === selectedDate).map((medication) => <div className="agenda-event refill-event" key={`refill-${medication.id}`}><strong>✿ Repor: {medication.name}</strong>Estoque previsto para terminar · {medication.quantity} {medication.unit} restantes<button className="text-button" onClick={() => onEditMedication(medication)}>Editar medicamento</button></div>)}
          {!selectedAppointments.length && !activeMedications.length && !medications.some((medication) => depletionFor(medication).date === selectedDate) && <div className="empty-state"><p>Nenhum compromisso neste dia.</p></div>}
          <div className="agenda-create-actions"><button className="button button-soft" onClick={() => onAddAppointment(selectedDate)}>＋ Consulta</button><button className="button button-quiet" onClick={() => onAddMedication(selectedDate)}>＋ Medicamento</button></div>
        </section>
      </div>
    </section>
  );
}
