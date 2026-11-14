import type { Medication } from "../types";
import { depletionFor, formatDate, treatmentDays } from "../lib/health";
import { MedicationArtwork } from "./MedicationArtwork";

type Props = {
  medications: Medication[];
  onAdd: () => void;
  onEdit: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
  onRefill: (medication: Medication) => void;
};

function ActionIcon({ kind }: { kind: "refill" | "edit" | "remove" }) {
  const paths = {
    refill: <><path d="M12 5v14M5 12h14" /></>,
    edit: <><path d="m4 16.5-.8 4.3 4.3-.8L19 8.5 15.5 5z" /><path d="m13.8 6.7 3.5 3.5" /></>,
    remove: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3" /></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">{paths[kind]}</svg>;
}

function friendlyTimes(times: string[]): string {
  const formatted = times.map((time) => {
    const [hour, minute] = time.split(":").map(Number);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return time;
    if (hour === 0 && minute === 0) return "meia-noite";
    const period = hour < 6 ? "da madrugada" : hour < 12 ? "da manhã" : hour < 18 ? "da tarde" : "da noite";
    return minute ? `${hour}h${String(minute).padStart(2, "0")} ${period}` : `${hour}h ${period}`;
  });
  return `Todos os dias às ${formatted.join(" e ")}`;
}

export function MedicationsView({ medications, onAdd, onEdit, onDelete, onRefill }: Props) {
  return (
    <section className="view" aria-labelledby="medications-title">
      <div className="page-heading">
        <div><p className="eyebrow">SUA ROTINA, NO SEU RITMO</p><h1 id="medications-title">Meus medicamentos</h1><p className="subheading">Acompanhe os horários e mantenha seu estoque por perto.</p></div>
        <button className="button button-primary" onClick={onAdd}>＋ Adicionar medicamento</button>
      </div>
      {medications.length ? (
        <div className="medications-grid">
          {medications.map((medication) => {
            const depletion = depletionFor(medication);
            const percent = medication.initialQuantity ? Math.max(0, Math.min(100, medication.quantity / medication.initialQuantity * 100)) : 0;
            const courseDays = treatmentDays(medication.treatment);
            const stockLevel = percent <= 15 ? "critical" : percent <= 40 ? "low" : "good";
            return (
              <article className="card medicine-card" key={medication.id}>
                <div className="medicine-card-top">
                  <MedicationArtwork className="medicine-card-artwork" name={medication.name} unit={medication.unit} dose={medication.dose} image={medication.image} />
                  <div className="medicine-card-summary">
                    <h2>{medication.name}</h2>
                    <p className="medicine-time">{friendlyTimes(medication.times)}</p>
                    <p className="medicine-dose">{medication.dose}</p>
                  </div>
                </div>
                <div className={`stock-line stock-line-${stockLevel}`}>
                  <div className="stock-line-top"><strong>{medication.quantity} {medication.unit} disponíveis</strong><span className="stock-status">{stockLevel === "critical" ? "Estoque acabando" : stockLevel === "low" ? "Estoque baixo" : "Estoque bom"}</span></div>
                  <div className="progress-track" role="progressbar" aria-label={`Estoque de ${medication.name}`} aria-valuetext={`${Math.round(percent)}% restante`} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
                </div>
                <p className="stock-forecast">{depletion.days === 0 ? "Pode acabar hoje" : `Dura cerca de ${depletion.days + 1} dias`} · previsão: {formatDate(depletion.date)}</p>
                {courseDays && depletion.days < courseDays && <p className="stock-warning">Este estoque pode acabar antes do fim do tratamento. Planeje a reposição.</p>}
                <div className="medicine-actions">
                  <button className="medicine-action" type="button" onClick={() => onRefill(medication)} aria-label={`Repor estoque de ${medication.name}`} title="Repor estoque"><ActionIcon kind="refill" /><span>Repor</span></button>
                  <button className="medicine-action" type="button" onClick={() => onEdit(medication)} aria-label={`Editar ${medication.name}`} title="Editar medicamento"><ActionIcon kind="edit" /><span>Editar</span></button>
                  <button className="medicine-action medicine-action-remove" type="button" onClick={() => onDelete(medication)} aria-label={`Remover ${medication.name}`} title="Remover medicamento"><ActionIcon kind="remove" /><span>Remover</span></button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card empty-state"><span className="empty-flower">🌱</span><p>Ainda não há medicamentos cadastrados.</p><p>Adicione o primeiro para acompanhar horários, estoque e lembretes.</p><button className="button button-primary" onClick={onAdd}>Adicionar medicamento</button></div>
      )}
    </section>
  );
}
