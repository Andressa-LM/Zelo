import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Patient } from "../types";
import { ageFor } from "../lib/health";

type Props = { patient: Patient; saveStatus: string; onSave: (patient: Patient) => void };

function formatBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasCountryCode = digits.startsWith("55") && (value.trim().startsWith("+55") || digits.length > 11);
  const localNumber = (hasCountryCode ? digits.slice(2) : digits).slice(0, 11);
  const countryPrefix = hasCountryCode ? "+55 " : "";
  if (!localNumber) return countryPrefix;
  if (localNumber.length <= 2) return `${countryPrefix}(${localNumber}`;

  const areaCode = localNumber.slice(0, 2);
  const subscriber = localNumber.slice(2);
  const firstPartLength = localNumber.length > 10 ? 5 : 4;
  const firstPart = subscriber.slice(0, firstPartLength);
  const secondPart = subscriber.slice(firstPartLength);
  return `${countryPrefix}(${areaCode}) ${firstPart}${secondPart ? `-${secondPart}` : ""}`;
}

function normalizeBrazilianPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const hasCountryCode = digits.startsWith("55") && (value.trim().startsWith("+55") || digits.length > 11);
  const localNumber = hasCountryCode ? digits.slice(2) : digits;
  return localNumber ? `+55${localNumber}` : "";
}

export function ProfileView({ patient, saveStatus, onSave }: Props) {
  const [form, setForm] = useState(patient);
  const [photoError, setPhotoError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [saveSubmitted, setSaveSubmitted] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!saveSubmitted || !saveStatus.startsWith("Salvo na nuvem")) return;
    const timer = window.setTimeout(() => setSaveSubmitted(false), 3500);
    return () => window.clearTimeout(timer);
  }, [saveStatus, saveSubmitted]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const whatsappPhone = normalizeBrazilianPhone(form.whatsappPhone);
    const localDigits = whatsappPhone.replace(/^\+55/, "");
    if (form.whatsappOptIn && !/^[1-9]\d[2-9]\d{7,8}$/.test(localDigits)) {
      setPhoneError("Para ativar os avisos, informe um telefone brasileiro válido com DDD.");
      return;
    }
    setPhoneError("");
    onSave({ ...form, whatsappPhone });
    setSaveSubmitted(true);
  }

  function updatePhone(value: string, input: HTMLInputElement) {
    const oldCaret = input.selectionStart ?? value.length;
    const digitsBeforeCaret = value.slice(0, oldCaret).replace(/\D/g, "").length;
    const formatted = formatBrazilianPhone(value);
    setPhoneError("");
    setForm((current) => ({ ...current, whatsappPhone: formatted }));
    requestAnimationFrame(() => {
      let digitCount = 0;
      let caret = digitsBeforeCaret === 0 && oldCaret === 0 ? 0 : formatted.length;
      if (digitsBeforeCaret === 0 && oldCaret > 0) {
        const firstDigit = formatted.search(/\d/);
        caret = firstDigit < 0 ? formatted.length : firstDigit;
      } else {
        for (let index = 0; index < formatted.length; index += 1) {
          if (/\d/.test(formatted[index])) digitCount += 1;
          if (digitCount >= digitsBeforeCaret) {
            caret = index + 1;
            break;
          }
        }
      }
      input.setSelectionRange(caret, caret);
    });
  }

  async function updatePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    setPhotoError("");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Escolha uma imagem JPEG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Não foi possível preparar a imagem.");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      const photo = canvas.toDataURL("image/webp", 0.78);
      if (photo.length > 350_000) {
        setPhotoError("Essa imagem ficou grande demais. Escolha uma imagem mais simples.");
        return;
      }
      setForm((current) => ({ ...current, avatarDataUrl: photo }));
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Não foi possível abrir essa imagem.");
    }
  }

  return (
    <section className="view" aria-labelledby="profile-title">
      <div className="page-heading">
        <div><p className="eyebrow">SEU CUIDADO COMEÇA POR VOCÊ</p><h1 id="profile-title">Meu perfil</h1><p className="subheading">Atualize suas informações quando precisar.</p></div>
      </div>
      <form className="card profile-form" onSubmit={submit} onChange={() => setSaveSubmitted(false)}>
        <div className="profile-intro">
          <button className="profile-photo-button" type="button" onClick={() => photoInput.current?.click()} aria-label="Escolher foto de perfil">
            {form.avatarDataUrl ? <img src={form.avatarDataUrl} alt="Sua foto de perfil" /> : <span aria-hidden="true">♡</span>}
          </button>
          <div className="profile-photo-copy">
            <h2>Suas informações</h2>
            <p className="muted">A idade é calculada a partir da data de nascimento.</p>
            <div className="profile-photo-actions">
              <button className="text-button" type="button" onClick={() => photoInput.current?.click()}>Adicionar foto</button>
              {form.avatarDataUrl && <button className="text-button" type="button" onClick={() => setForm((current) => ({ ...current, avatarDataUrl: "" }))}>Remover foto</button>}
            </div>
            <input ref={photoInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void updatePhoto(event)} aria-label="Selecionar foto de perfil" />
            {photoError && <p className="photo-error" role="alert">{photoError}</p>}
          </div>
        </div>
        <div className="form-grid">
          <label className="field field-wide">Nome completo<input autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Como podemos chamar você?" /></label>
          <label className="field field-wide">Como você se identifica? <span className="optional-label">opcional</span>
            <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Patient["gender"] })}>
              <option value="">Prefiro uma saudação neutra</option><option value="homem">Homem</option><option value="mulher">Mulher</option><option value="homem-trans">Homem trans</option><option value="mulher-trans">Mulher trans</option><option value="genero-fluido">Gênero fluido</option><option value="outra">Outra identidade</option><option value="nao-informar">Prefiro não informar</option>
            </select>
            <small>Essa informação é opcional e serve somente para personalizar a saudação.</small>
          </label>
          <label className="field">Data de nascimento<input type="date" value={form.dob} onChange={(event) => setForm({ ...form, dob: event.target.value })} /></label>
          <label className="field">Idade<input readOnly value={ageFor(form.dob)} placeholder="Calculada automaticamente" /></label>
          <label className="field field-wide">Endereço<textarea rows={2} autoComplete="street-address" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Rua, número, cidade" /></label>
          <label className="field field-wide">Condições de saúde e alergias<textarea rows={3} value={form.conditions} onChange={(event) => setForm({ ...form, conditions: event.target.value })} placeholder="Ex.: anemia ferropriva, hipertensão, alergia a..." /><small>Use vírgulas ou uma condição por linha.</small></label>
        </div>
        <div className="profile-preferences">
          <div>
            <p className="eyebrow">LEMBRETES COM A SUA CARA</p>
            <h2>Como prefere ser lembrada?</h2>
            <p className="muted">Personalize o tom dos avisos de horário neste navegador.</p>
          </div>
          <div className="form-grid">
            <label className="field field-wide">Estilo da mensagem
              <select value={form.reminderTone} onChange={(event) => setForm({ ...form, reminderTone: event.target.value as Patient["reminderTone"] })}>
                <option value="carinhoso">Carinhoso e tranquilo</option>
                <option value="atencao">Chamativo e direto</option>
                <option value="familiar">Como um lembrete da família</option>
                <option value="personalizado">Escrever minha própria mensagem</option>
              </select>
            </label>
            {form.reminderTone === "personalizado" && (
              <label className="field field-wide">Sua mensagem
                <textarea rows={3} maxLength={240} value={form.reminderMessage} onChange={(event) => setForm({ ...form, reminderMessage: event.target.value })} placeholder="Ex.: Olá, {nome}! Está na hora dos seus remédios: {medicamentos}. {estoque}" />
                <small>Você pode usar {`{nome}`}, {`{momento}`}, {`{medicamentos}`} e {`{estoque}`} para preencher automaticamente.</small>
              </label>
            )}
          </div>
          <p className="privacy-note">Os avisos do navegador funcionam enquanto o Zelo estiver aberto e podem aparecer na tela bloqueada. Evite incluir informações que prefira manter privadas.</p>
        </div>
        <div className="profile-preferences">
          <div>
            <p className="eyebrow">REPOSIÇÃO DE ESTOQUE</p>
            <h2>Lembretes pelo WhatsApp</h2>
            <p className="muted">O Zelo pode avisar quando um medicamento cadastrado estiver perto de acabar.</p>
          </div>
          <div className="form-grid">
            <label className="field field-wide">Número do WhatsApp
              <input type="tel" autoComplete="tel" inputMode="tel" value={formatBrazilianPhone(form.whatsappPhone)} onChange={(event) => updatePhone(event.target.value, event.currentTarget)} placeholder="(11) 91234-5678" aria-invalid={Boolean(phoneError)} aria-describedby={phoneError ? "whatsapp-phone-error" : "whatsapp-phone-hint"} />
              <small id="whatsapp-phone-hint">Digite o DDD e o número. O código do Brasil (+55) será incluído ao salvar.</small>
              {phoneError && <small id="whatsapp-phone-error" className="field-error" role="alert">{phoneError}</small>}
            </label>
            <label className="consent-row field-wide">
              <input type="checkbox" checked={form.whatsappOptIn} onChange={(event) => setForm({ ...form, whatsappOptIn: event.target.checked })} />
              <span>Autorizo o envio de lembretes automáticos de reposição para este número pelo WhatsApp.</span>
            </label>
            <p className="privacy-note field-wide">O envio depende da configuração da WhatsApp Business Cloud API e de um modelo de mensagem aprovado pela Meta. O lembrete pode revelar o nome do medicamento a quem tiver acesso a essa conta.</p>
          </div>
        </div>
        <div className="form-actions">
          <div className="profile-save-status" aria-live="polite">
            {saveSubmitted && saveStatus.startsWith("Salvo na nuvem")
              ? <span className="profile-save-feedback" role="status">Perfil salvo com sucesso!</span>
              : saveSubmitted && saveStatus.startsWith("Falha ao salvar")
                ? <span className="profile-save-feedback profile-save-error" role="alert">{saveStatus}</span>
                : saveSubmitted
                  ? <span className="profile-save-feedback" role="status">Salvando suas alterações…</span>
                  : <span className="muted">Suas informações ficam salvas na sua conta.</span>}
          </div>
          <button className="button button-primary" type="submit">Salvar meu perfil</button>
        </div>
      </form>
    </section>
  );
}
