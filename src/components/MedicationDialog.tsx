import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { Medication, MedicationDraft } from "../types";
import { todayKey } from "../lib/health";
import { fetchMedicationImage, searchMedicationSuggestions, type MedicationSuggestion } from "../lib/integrations";
import { MedicationArtwork } from "./MedicationArtwork";

type Props = {
  open: boolean;
  medication: Medication | null;
  startDate: string;
  onClose: () => void;
  onSave: (draft: MedicationDraft) => void;
};

const units = ["comprimidos", "cápsulas", "mL", "mg", "gotas", "ampolas", "frascos", "unidades"];
const treatmentOptions = ["5 dias", "7 dias", "14 dias", "1 mês", "3 meses", "6 meses", "12 meses", "uso contínuo"];
const MAX_MEDICATION_IMAGE_SIZE = 450_000;

async function prepareMedicationImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Escolha uma imagem JPEG, PNG ou WEBP.");
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error("A imagem deve ter até 10 MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 40_000_000) {
      throw new Error("A foto tem resolução muito alta. Escolha uma imagem menor.");
    }
    const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    let image = canvas.toDataURL("image/webp", 0.76);
    if (image.length > MAX_MEDICATION_IMAGE_SIZE) {
      const smallerCanvas = document.createElement("canvas");
      smallerCanvas.width = Math.max(1, Math.round(canvas.width * 0.75));
      smallerCanvas.height = Math.max(1, Math.round(canvas.height * 0.75));
      const smallerContext = smallerCanvas.getContext("2d");
      if (!smallerContext) throw new Error("Não foi possível reduzir a imagem.");
      smallerContext.drawImage(canvas, 0, 0, smallerCanvas.width, smallerCanvas.height);
      image = smallerCanvas.toDataURL("image/jpeg", 0.62);
    }
    if (image.length > MAX_MEDICATION_IMAGE_SIZE) {
      throw new Error("A imagem ainda ficou muito grande. Escolha uma foto menor.");
    }
    return image;
  } finally {
    bitmap.close();
  }
}

export function MedicationDialog({ open, medication, startDate, onClose, onSave }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | undefined>(undefined);
  const imageSequence = useRef(0);
  const suggestionSequence = useRef(0);
  const suggestionController = useRef<AbortController | null>(null);
  const [image, setImage] = useState(medication?.image ?? "");
  const [formMessage, setFormMessage] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [customImage, setCustomImage] = useState(medication?.image.startsWith("data:image/") ?? false);
  const [medicationName, setMedicationName] = useState(medication?.name ?? "");
  const [suggestions, setSuggestions] = useState<MedicationSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsUnavailable, setSuggestionsUnavailable] = useState(false);
  const [suggestionsSearched, setSuggestionsSearched] = useState(false);
  const [imageSearchBusy, setImageSearchBusy] = useState(false);
  const [doseText, setDoseText] = useState(medication?.dose ?? "");
  const [stockUnit, setStockUnit] = useState(medication?.unit ?? "comprimidos");
  const [times, setTimes] = useState(medication?.times.length ? medication.times : ["08:00"]);
  const initialTreatment = medication?.treatment ?? "3 meses";
  const [treatmentChoice, setTreatmentChoice] = useState(
    treatmentOptions.includes(initialTreatment) ? initialTreatment : "personalizado",
  );
  const [customTreatment, setCustomTreatment] = useState(
    treatmentOptions.includes(initialTreatment) ? "" : initialTreatment,
  );

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

  useEffect(() => () => {
    window.clearTimeout(searchTimer.current);
    suggestionController.current?.abort();
    imageSequence.current += 1;
  }, []);

  function updateMedicationName(value: string) {
    if (value.trim() !== medication?.name && image) {
      imageSequence.current += 1;
      setImage("");
      setCustomImage(false);
      setImageMessage("");
    }
    setMedicationName(value);
    setSuggestions([]);
    setSuggestionsUnavailable(false);
    setSuggestionsSearched(false);
    setActiveSuggestion(-1);
    setSuggestionsOpen(value.trim().length >= 2);
    window.clearTimeout(searchTimer.current);
    suggestionController.current?.abort();
    if (value.trim().length < 2) {
      setSuggestionsLoading(false);
      return;
    }

    const sequence = ++suggestionSequence.current;
    setSuggestionsLoading(true);
    searchTimer.current = window.setTimeout(async () => {
      const controller = new AbortController();
      suggestionController.current = controller;
      try {
        const result = await searchMedicationSuggestions(value, controller.signal);
        if (sequence !== suggestionSequence.current) return;
        setSuggestions(result);
        setSuggestionsSearched(true);
      } catch {
        if (sequence === suggestionSequence.current && !controller.signal.aborted) {
          setSuggestions([]);
          setSuggestionsUnavailable(true);
          setSuggestionsSearched(true);
        }
      } finally {
        if (sequence === suggestionSequence.current) setSuggestionsLoading(false);
      }
    }, 350);
  }

  function chooseSuggestion(suggestion: MedicationSuggestion) {
    if (suggestion.name !== medicationName && suggestion.name !== medication?.name && image) {
      imageSequence.current += 1;
      setImage("");
      setCustomImage(false);
    }
    setMedicationName(suggestion.name);
    setImageMessage("");
    setSuggestions([]);
    setSuggestionsOpen(false);
    setActiveSuggestion(-1);
  }

  function handleNameKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || !suggestions.length) {
      if (event.key === "Escape") setSuggestionsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeSuggestion >= 0) {
      event.preventDefault();
      chooseSuggestion(suggestions[activeSuggestion]);
    } else if (event.key === "Escape") {
      setSuggestionsOpen(false);
    }
  }

  async function uploadMedicationImage(file?: File) {
    if (!file) return;
    setImageMessage("");
    try {
      const imageData = await prepareMedicationImage(file);
      imageSequence.current += 1;
      setImage(imageData);
      setCustomImage(true);
      setImageSearchBusy(false);
      setImageMessage("Foto pronta. Ela será salva junto com este medicamento.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "Não foi possível abrir essa imagem.");
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  function removeMedicationImage() {
    imageSequence.current += 1;
    setImage("");
    setCustomImage(false);
    setImageSearchBusy(false);
    setImageMessage("A ilustração de apoio será exibida no lugar da foto.");
  }

  async function findSuggestedImage() {
    if (!medicationName.trim()) {
      setImageMessage("Informe o nome do medicamento antes de buscar uma imagem.");
      return;
    }
    const sequence = ++imageSequence.current;
    setImageSearchBusy(true);
    setImageMessage("Buscando uma imagem ilustrativa…");
    try {
      const result = await fetchMedicationImage(medicationName);
      if (sequence !== imageSequence.current) return;
      if (result.isFallback) {
        setImage("");
        setCustomImage(false);
        setImageMessage("Não encontramos uma imagem confiável para este nome. Você pode escolher uma foto do seu aparelho.");
        return;
      }
      setImage(result.imageUrl);
      setCustomImage(false);
      setImageMessage("Imagem ilustrativa encontrada; ela pode não corresponder ao fabricante ou à embalagem do seu remédio.");
    } catch {
      if (sequence !== imageSequence.current) return;
      setImage("");
      setCustomImage(false);
      setImageMessage("Não foi possível buscar uma imagem agora. Você pode escolher uma foto do seu aparelho.");
    } finally {
      if (sequence === imageSequence.current) setImageSearchBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get("name") ?? "").trim();
    const dose = String(values.get("dose") ?? "").trim();
    const selectedTimes = [...new Set(times.map((time) => time.trim()))];
    const startDateValue = String(values.get("startDate") ?? "");
    const quantity = Number(values.get("quantity"));
    const unitsPerDose = Number(values.get("unitsPerDose"));
    const treatment = treatmentChoice === "personalizado" ? customTreatment.trim() : treatmentChoice;
    if (!selectedTimes.length || selectedTimes.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      setFormMessage("Confira os horários de tomada.");
      return;
    }
    if (!treatment) {
      setFormMessage("Informe a duração do tratamento.");
      return;
    }
    setFormMessage("");
    onSave({
      ...(medication ? { id: medication.id } : {}),
      name,
      dose,
      times: selectedTimes.sort(),
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
        <section className="medication-form-section" aria-labelledby="medicine-identification-title">
          <div className="medication-form-section-heading">
            <span aria-hidden="true">1</span><div><h3 id="medicine-identification-title">Qual é o remédio?</h3><p>Informe o nome que aparece na embalagem.</p></div>
          </div>
          <label className="field">Nome do medicamento *
            <div className="medication-name-search">
              <input
                name="name"
                required
                maxLength={100}
                value={medicationName}
                placeholder="Comece a digitar o nome"
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={suggestionsOpen && (suggestions.length > 0 || suggestionsLoading || suggestionsSearched)}
                aria-controls={suggestionsOpen && suggestions.length > 0 ? "medication-name-suggestions" : undefined}
                aria-activedescendant={suggestionsOpen && activeSuggestion >= 0 ? `medication-suggestion-${activeSuggestion}` : undefined}
                aria-busy={suggestionsLoading}
                onChange={(event) => updateMedicationName(event.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
              />
              {suggestionsOpen && (suggestions.length > 0 || suggestionsLoading || suggestionsSearched) && (
                <div className="medication-suggestions">
                  {suggestionsLoading && <p className="medication-suggestions-status" role="status">Procurando nomes parecidos…</p>}
                  {!suggestionsLoading && suggestionsUnavailable && <p className="medication-suggestions-status" role="status">Não foi possível carregar sugestões. Você pode continuar digitando.</p>}
                  {!suggestionsLoading && !suggestionsUnavailable && suggestionsSearched && suggestions.length === 0 && <p className="medication-suggestions-status" role="status">Nenhuma sugestão encontrada. Você pode continuar digitando.</p>}
                  {suggestions.length > 0 && (
                    <div id="medication-name-suggestions" role="listbox" aria-label="Sugestões de medicamentos">
                      {suggestions.map((suggestion, index) => (
                        <button
                          className={`medication-suggestion ${activeSuggestion === index ? "active" : ""}`}
                          id={`medication-suggestion-${index}`}
                          key={suggestion.id}
                          type="button"
                          role="option"
                          aria-selected={activeSuggestion === index}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseSuggestion(suggestion)}
                        >
                          <strong>{suggestion.name}</strong>
                          <span>{[suggestion.presentation, suggestion.manufacturer].filter(Boolean).join(" · ")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <small>As sugestões vêm de um catálogo externo (FarmaBook). O nome digitado é enviado para a busca; confira se corresponde ao seu medicamento.</small>
          </label>
          <div className="image-preview">
            <MedicationArtwork name={medicationName} unit={stockUnit} dose={doseText} image={image} />
            <div className="image-preview-content">
              <span>{image ? (customImage ? "Sua foto foi selecionada." : "Imagem ilustrativa; confira o nome na embalagem.") : "Sem foto? Você pode buscar uma sugestão ou escolher uma imagem do seu aparelho."}</span>
              <div className="image-preview-actions">
                <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadMedicationImage(event.target.files?.[0])} aria-label="Escolher imagem do medicamento" />
                <button className="button button-soft image-upload-button" type="button" onClick={() => imageInputRef.current?.click()}>{image ? "Trocar foto" : "Escolher foto"}</button>
                <button className="text-button image-search-button" type="button" disabled={imageSearchBusy || !medicationName.trim()} onClick={() => void findSuggestedImage()}>{imageSearchBusy ? "Buscando…" : "Buscar imagem sugerida"}</button>
                {image && <button className="text-button image-remove-button" type="button" onClick={removeMedicationImage}>Remover foto</button>}
              </div>
              <small className="image-search-disclaimer">Uma imagem encontrada pode não ser do mesmo fabricante ou apresentação. Confirme na embalagem.</small>
              {imageMessage && <small className="image-upload-message" role="status">{imageMessage}</small>}
            </div>
          </div>
        </section>
        <section className="medication-form-section" aria-labelledby="medicine-schedule-title">
          <div className="medication-form-section-heading">
            <span aria-hidden="true">2</span><div><h3 id="medicine-schedule-title">Como foi orientado?</h3><p>Use as informações da receita ou da orientação profissional.</p></div>
          </div>
          <div className="form-grid">
            <label className="field field-wide">Como tomar? *
              <input name="dose" required maxLength={140} value={doseText} onChange={(event) => setDoseText(event.target.value)} placeholder="Ex.: 1 comprimido de 500 mg ou 5 mL" />
              <small>Copie a orientação sem alterar a dose.</small>
            </label>
            <label className="field field-wide" htmlFor="medication-time-count">Quantos horários por dia?
              <select id="medication-time-count" value={times.length} onChange={(event) => setTimes((current) => Array.from({ length: Number(event.target.value) }, (_, index) => current[index] ?? "08:00"))}>
                {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} {count === 1 ? "horário" : "horários"}</option>)}
              </select>
            </label>
            <div className="field field-wide">
              <span>Quais são os horários?</span>
              <div className="time-fields">
                {times.map((time, index) => (
                  <label className="field" key={index}>Horário {index + 1}
                    <input type="time" required value={time} onChange={(event) => setTimes((current) => current.map((value, timeIndex) => timeIndex === index ? event.target.value : value))} />
                  </label>
                ))}
              </div>
              <input name="times" type="hidden" value={times.join(", ")} />
            </div>
            <label className="field">Começar em *
              <input name="startDate" type="date" required defaultValue={medication?.startDate ?? startDate} />
            </label>
            <label className="field">Por quanto tempo? *
              <select value={treatmentChoice} onChange={(event) => setTreatmentChoice(event.target.value)}>
                {treatmentOptions.map((option) => <option key={option} value={option}>{option === "uso contínuo" ? "Uso contínuo" : option}</option>)}
                <option value="personalizado">Outro período…</option>
              </select>
              {treatmentChoice === "personalizado" && <input name="treatment" required value={customTreatment} onChange={(event) => setCustomTreatment(event.target.value)} placeholder="Ex.: 6 semanas" />}
            </label>
          </div>
        </section>
        <section className="medication-form-section" aria-labelledby="medicine-stock-title">
          <div className="medication-form-section-heading">
            <span aria-hidden="true">3</span><div><h3 id="medicine-stock-title">Vamos cuidar do estoque</h3><p>Essas informações ajudam a avisar quando estiver perto de acabar.</p></div>
          </div>
          <div className="form-grid">
            <label className="field">Unidade do estoque *
              <select name="unit" value={stockUnit} onChange={(event) => setStockUnit(event.target.value)}>{units.map((unit) => <option key={unit}>{unit}</option>)}</select>
            </label>
            <label className="field">Quanto usa por horário? *
              <input name="unitsPerDose" type="number" min="0.01" step="0.01" required defaultValue={medication?.unitsPerDose ?? 1} />
              <small>Ex.: 1 comprimido ou 5 mL.</small>
            </label>
            <label className="field field-wide">Quanto ainda tem na embalagem? *
              <input name="quantity" type="number" min="0" step="0.01" required defaultValue={medication?.quantity ?? ""} placeholder={`Ex.: 30 ${stockUnit}`} />
              <small>Informe a quantidade que está disponível agora.</small>
            </label>
          </div>
        </section>
        {formMessage && <p className="form-message" role="alert">{formMessage}</p>}
        <div className="form-actions dialog-actions">
          <button className="button button-quiet" type="button" onClick={onClose}>Cancelar</button>
          <button className="button button-primary" type="submit">Salvar medicamento</button>
        </div>
      </form>
    </dialog>
  );
}
