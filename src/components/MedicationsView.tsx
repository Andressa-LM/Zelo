import type { Medication } from "../types";
import { depletionFor, formatDate, treatmentDays, whatsappUrl } from "../lib/health";

type Props = {
  medications: Medication[];
  patientName: string;
  onAdd: () => void;
  onEdit: (medication: Medication) => void;
  onDelete: (medication: Medication) => void;
  onRefill: (medication: Medication) => void;
  onFindImage: (medication: Medication) => void;
};

export function MedicationsView({ medications, patientName, onAdd, onEdit, onDelete, onRefill, onFindImage }: Props) {
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
            return (
              <article className="card medicine-card" key={medication.id}>
                <div className="medicine-card-top">
                  <div className="med-icon">{medication.image ? <img src={medication.image} alt={`Imagem ilustrativa de ${medication.name}`} loading="lazy" /> : "✿"}</div>
                  <div className="med-info"><h3>{medication.name}</h3><p>{medication.dose}</p><p>{medication.times.join(" · ")} · {medication.treatment}</p></div>
                </div>
                <div className="stock-line">
                  <div className="stock-line-top"><strong>Estoque: {medication.quantity} {medication.unit}</strong><span>{depletion.days === 0 ? "pode terminar hoje" : `cerca de ${depletion.days + 1} dias`}</span></div>
                  <div className="progress-track" role="progressbar" aria-label={`Estoque de ${medication.name}`} aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
                </div>
                {courseDays && depletion.days < courseDays && <p className="stock-warning">O estoque estimado cobre {depletion.days + 1} dias, menos que a duração informada. Planeje a reposição com antecedência.</p>}
                <p className="appointment-detail">Previsão de término do estoque: {formatDate(depletion.date)}</p>
                <div className="medicine-actions">
                  <button className="button button-soft" onClick={() => onRefill(medication)}>＋ Repor estoque</button>
                  <button className="button button-quiet" onClick={() => onEdit(medication)}>Editar</button>
                  <button className="button button-quiet" onClick={() => onFindImage(medication)}>Buscar imagem</button>
                  <a className="button button-quiet" href={whatsappUrl(patientName, medication)} target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
                  <button className="button button-quiet" onClick={() => onDelete(medication)}>Remover</button>
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
