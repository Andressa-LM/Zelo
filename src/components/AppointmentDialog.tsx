import { useEffect, useRef, type FormEvent } from "react";
import type { Appointment, AppointmentDraft } from "../types";
import { todayKey } from "../lib/health";

type Props = {
  open: boolean;
  appointment: Appointment | null;
  date: string;
  onClose: () => void;
  onSave: (draft: AppointmentDraft) => void;
};

export function AppointmentDialog({ open, appointment, date, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    onSave({
      ...(appointment ? { id: appointment.id } : {}),
      title: String(values.get("title") ?? "").trim(),
      date: String(values.get("date") ?? ""),
      time: String(values.get("time") ?? ""),
      notes: String(values.get("notes") ?? "").trim(),
    });
  }

  return (
    <dialog
      className="app-dialog"
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
      aria-labelledby="appointment-dialog-title"
    >
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="eyebrow">UM TEMPINHO PARA VOCÊ</p><h2 id="appointment-dialog-title">{appointment ? "Editar consulta" : "Adicionar consulta"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <label className="field">Especialidade ou profissional *<input name="title" required maxLength={100} defaultValue={appointment?.title ?? ""} placeholder="Ex.: Consulta com cardiologista" /></label>
        <div className="form-grid">
          <label className="field">Data *<input name="date" type="date" required defaultValue={appointment?.date ?? date ?? todayKey()} /></label>
          <label className="field">Horário<input name="time" type="time" defaultValue={appointment?.time ?? ""} /></label>
        </div>
        <label className="field">Observações<textarea name="notes" rows={2} defaultValue={appointment?.notes ?? ""} placeholder="Endereço, preparo ou lembretes" /></label>
        <div className="form-actions dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button>
          <button className="button button-primary" type="submit">Salvar consulta</button>
        </div>
      </form>
    </dialog>
  );
}
