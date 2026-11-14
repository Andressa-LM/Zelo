import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Patient } from "../types";
import { ageFor } from "../lib/health";

type Props = { patient: Patient; onSave: (patient: Patient) => void };

export function ProfileView({ patient, onSave }: Props) {
  const [form, setForm] = useState(patient);
  const [photoError, setPhotoError] = useState("");
  const photoInput = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(form);
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
      <form className="card profile-form" onSubmit={submit}>
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
        <div className="form-actions"><span className="muted">Salvo com segurança na sua conta.</span><button className="button button-primary" type="submit">Salvar meu perfil</button></div>
      </form>
    </section>
  );
}
