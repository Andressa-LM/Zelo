import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Medication, MedicationDraft } from "../types";
import { parsePrescriptionText, todayKey } from "../lib/health";
import { readPrescriptionWithGemini, searchMedicationImage } from "../lib/integrations";

type Props = {
  open: boolean;
  medication: Medication | null;
  startDate: string;
  onClose: () => void;
  onSave: (draft: MedicationDraft) => void;
};

const units = ["comprimidos", "cápsulas", "mL", "mg", "gotas", "unidades"];

export function MedicationDialog({ open, medication, startDate, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageSequence = useRef(0);
  const [image, setImage] = useState(medication?.image ?? "");
  const [imageMessage, setImageMessage] = useState("");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMessage, setAssistantMessage] = useState("");
  const [prescription, setPrescription] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open || medication || !startDate) return;
    const form = dialogRef.current?.querySelector<HTMLFormElement>("form");
    const dateInput = form?.elements.namedItem("startDate") as HTMLInputElement | null;
    if (dateInput) dateInput.value = startDate;
  }, [open, medication, startDate]);

  async function updateImage(name: string) {
    const sequence = ++imageSequence.current;
    if (!name.trim()) {
      setImage("");
      setImageMessage("");
      return;
    }
    setImageMessage("Buscando imagem ilustrativa…");
    window.setTimeout(async () => {
      try {
        const result = await searchMedicationImage(name.trim());
        if (sequence !== imageSequence.current) return;
        setImage(result);
        setImageMessage("Imagem ilustrativa. Ela pode não corresponder à embalagem.");
      } catch (error) {
        if (sequence !== imageSequence.current) return;
        setImage("");
        setImageMessage(error instanceof Error ? `${error.message} Você pode salvar sem imagem.` : "Não foi possível buscar a imagem.");
      }
    }, 500);
  }

  async function parsePrescription(file?: File) {
    setAssistantMessage("");
    if (!prescription.trim() && !file) {
      setAssistantMessage("Cole o texto da receita ou escolha uma foto.");
      return;
    }
    if (file && (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setAssistantMessage("Escolha uma imagem JPEG, PNG ou WEBP com até 8 MB.");
      return;
    }
    const form = dialogRef.current?.querySelector<HTMLFormElement>("form");
    if (!geminiKey.trim()) {
      if (file) {
        setAssistantMessage("A leitura de fotos precisa de uma chave Gemini. Para texto, use a leitura básica.");
        return;
      }
      const parsed = parsePrescriptionText(prescription);
      if (parsed.name) {
        const name = form?.elements.namedItem("name") as HTMLInputElement | null;
        if (name) {
          name.value = parsed.name;
          void updateImage(parsed.name);
        }
      }
      if (parsed.times.length) {
        const times = form?.elements.namedItem("times") as HTMLInputElement | null;
        if (times) times.value = parsed.times.join(", ");
      }
      if (parsed.treatment) {
        const treatment = form?.elements.namedItem("treatment") as HTMLInputElement | null;
        if (treatment) treatment.value = parsed.treatment;
      }
      setAssistantMessage(
        parsed.name || parsed.times.length || parsed.treatment
          ? "Sugestões preenchidas. Confira a receita original e confirme com um profissional de saúde."
          : "Não encontramos campos com segurança. Preencha manualmente ou use uma chave Gemini.",
      );
      return;
    }
    setBusy(true);
    setAssistantMessage("Lendo a receita… confirme tudo com o documento original.");
    try {
      const parsed = await readPrescriptionWithGemini(prescription, file, geminiKey.trim());
      const assign = (field: string, value: string) => {
        const input = form?.elements.namedItem(field) as HTMLInputElement | null;
        if (input) input.value = value;
      };
      if (parsed.name) {
        assign("name", parsed.name.slice(0, 100));
        void updateImage(parsed.name);
      }
      if (parsed.dose) assign("dose", parsed.dose.slice(0, 140));
      if (Array.isArray(parsed.times)) assign("times", parsed.times.join(", "));
      if (Number.isFinite(parsed.unitsPerDose)) assign("unitsPerDose", String(parsed.unitsPerDose));
      if (Number.isFinite(parsed.quantity)) assign("quantity", String(parsed.quantity));
      if (units.includes(parsed.unit ?? "")) assign("unit", parsed.unit ?? units[0]);
      if (parsed.treatment) assign("treatment", parsed.treatment.slice(0, 100));
      setAssistantMessage("Sugestões preenchidas. Confira cada campo com a receita original e seu profissional de saúde.");
    } catch (error) {
      setAssistantMessage(error instanceof Error ? `Não foi possível ler a receita: ${error.message}` : "Não foi possível ler a receita.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const dose = String(values.get("dose") ?? "").trim();
    const times = [...new Set(String(values.get("times") ?? "").split(",").map((time) => time.trim()))];
    const startDateValue = String(values.get("startDate") ?? "");
    const quantity = Number(values.get("quantity"));
    const unitsPerDose = Number(values.get("unitsPerDose"));
    const treatment = String(values.get("treatment") ?? "").trim();
    if (!times.length || times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setImageMessage("Informe os horários no formato HH:MM, separados por vírgula.");
      return;
    }
    onSave({
      ...(medication ? { id: medication.id } : {}),
      name,
      dose,
      times: times.sort(),
      startDate: startDateValue || todayKey(),
      quantity,
      unitsPerDose,
      unit: String(values.get("unit")),
      treatment,
      image,
    });
  }

  return (
    <dialog
      className="app-dialog"
      ref={dialogRef}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClose={onClose}
      aria-labelledby="medication-dialog-title"
    >
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-heading">
          <div><p className="eyebrow">UM NOVO PASSO NO SEU CUIDADO</p><h2 id="medication-dialog-title">{medication ? "Editar medicamento" : "Adicionar medicamento"}</h2></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <details className="assistant-box" open={assistantOpen} onToggle={(event) => setAssistantOpen(event.currentTarget.open)}>
          <summary><span aria-hidden="true">✧</span> Preencher com ajuda da receita <small>opcional</small></summary>
          <p>Cole o texto da receita ou escolha uma foto legível. Confira os dados com a receita original e seu profissional de saúde.</p>
          <label className="field">Texto da receita<textarea rows={3} value={prescription} onChange={(event) => setPrescription(event.target.value)} placeholder="Cole aqui as orientações da receita…" /></label>
          <label className="field">Foto da receita<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void parsePrescription(event.target.files?.[0])} /></label>
          <div className="assistant-key-row">
            <label className="field">Chave Gemini (opcional)<input type="password" autoComplete="off" value={geminiKey} onChange={(event) => setGeminiKey(event.target.value)} placeholder="Usada apenas nesta sessão" /></label>
            <button className="button button-soft" type="button" disabled={busy} onClick={() => void parsePrescription()}>{busy ? "Lendo…" : "Ler receita"}</button>
          </div>
          <small className="muted">Sem chave, tentamos identificar horários e duração no texto. Fotos são enviadas ao Google Gemini.</small>
          {assistantMessage && <p className="assistant-message" role="status" aria-live="polite">{assistantMessage}</p>}
        </details>
        <div className="form-grid">
          <label className="field field-wide">Nome do medicamento *<input name="name" required maxLength={100} defaultValue={medication?.name ?? ""} placeholder="Ex.: Vitamina D" onChange={(event) => void updateImage(event.target.value)} /><small>O nome é enviado à busca pública do Wikimedia Commons para procurar uma imagem.</small></label>
          <label className="field field-wide">Dose / orientação *<input name="dose" required maxLength={140} defaultValue={medication?.dose ?? ""} placeholder="Ex.: 1 comprimido de 500 mg" /></label>
          <label className="field field-wide">Horários *<input name="times" required defaultValue={medication?.times.join(", ") ?? ""} placeholder="08:00, 20:00" /><small>Separe cada horário por vírgula.</small></label>
          <label className="field">Início do tratamento *<input name="startDate" type="date" required defaultValue={medication?.startDate ?? startDate} /></label>
          <label className="field">Unidades por tomada *<input name="unitsPerDose" type="number" min="0.01" step="0.01" required defaultValue={medication?.unitsPerDose ?? 1} /></label>
          <label className="field">Quantidade na embalagem atual *<input name="quantity" type="number" min="0" step="0.01" required defaultValue={medication?.quantity ?? ""} placeholder="Ex.: 30" /></label>
          <label className="field">Unidade do estoque *<select name="unit" defaultValue={medication?.unit ?? "comprimidos"}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select></label>
          <label className="field field-wide">Duração do tratamento *<input name="treatment" required defaultValue={medication?.treatment ?? ""} placeholder="Ex.: 3 meses, 6 semanas, uso contínuo" /></label>
        </div>
        {imageMessage && <p className="image-message" role="status">{imageMessage}</p>}
        {image && <div className="image-preview"><img src={image} alt="" /><span>Imagem ilustrativa. Confira a embalagem; ela pode não corresponder ao medicamento.</span></div>}
        <div className="form-actions dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button>
          <button className="button button-primary" type="submit">Salvar medicamento</button>
        </div>
      </form>
    </dialog>
  );
}
