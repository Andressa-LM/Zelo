import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "./components/AppShell";
import { AppointmentDialog } from "./components/AppointmentDialog";
import { AuthScreen } from "./components/AuthScreen";
import { CalendarView } from "./components/CalendarView";
import { Dashboard } from "./components/Dashboard";
import { MedicationDialog } from "./components/MedicationDialog";
import { MedicationsView } from "./components/MedicationsView";
import { ProfileView } from "./components/ProfileView";
import { ReportsView } from "./components/ReportsView";
import {
  LEGACY_STORAGE_KEY,
  emptyData,
  normalizeData,
  todayKey,
  treatmentEndDate,
} from "./lib/health";
import { searchMedicationImage } from "./lib/integrations";
import { authRedirectUrl, isGoogleAuthEnabled, isSupabaseConfigured, supabase } from "./lib/supabase";
import type {
  Appointment,
  AppointmentDraft,
  HealthLog,
  Medication,
  MedicationDraft,
  Patient,
  ViewName,
  ZeloData,
} from "./types";

type DialogState =
  | { kind: "closed" }
  | { kind: "new-medication"; date: string }
  | { kind: "edit-medication"; medication: Medication }
  | { kind: "new-appointment"; date: string }
  | { kind: "edit-appointment"; appointment: Appointment };

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<ZeloData>(emptyData);
  const [readyUserId, setReadyUserId] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<ViewName>("inicio");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [dialog, setDialog] = useState<DialogState>({ kind: "closed" });
  const activeUserId = useRef("");
  const loadingUserId = useRef("");
  const saveQueue = useRef(Promise.resolve());
  const revision = useRef(0);
  const toastTimer = useRef<number | undefined>(undefined);

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setNotice(""), 4300);
  }, []);

  const loadAccount = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user.id || !supabase) {
      activeUserId.current = "";
      loadingUserId.current = "";
      setSession(null);
      setReadyUserId("");
      setData(emptyData());
      setSaveStatus("");
      return;
    }

    const userId = nextSession.user.id;
    if (activeUserId.current === userId && (readyUserId === userId || loadingUserId.current === userId)) {
      setSession(nextSession);
      return;
    }
    activeUserId.current = userId;
    loadingUserId.current = userId;
    setSession(nextSession);
    setReadyUserId("");
    setAuthMessage("");
    setSaveStatus("Carregando seus dados…");

    try {
      const { data: row, error } = await supabase
        .from("user_data")
        .select("data")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (activeUserId.current !== userId) return;

      let accountData = row?.data ? normalizeData(row.data) : emptyData();
      if (!row?.data) {
        let legacyValue: string | null = null;
        try {
          legacyValue = localStorage.getItem(LEGACY_STORAGE_KEY);
        } catch (error) {
          console.error("Não foi possível acessar os dados antigos deste navegador.", error);
          notify("Não foi possível verificar os dados antigos deste navegador.");
        }
        if (legacyValue) {
          let legacyData: ZeloData | null = null;
          try {
            legacyData = normalizeData(JSON.parse(legacyValue));
          } catch (error) {
            console.error("Os dados locais antigos estão inválidos.", error);
            notify("Os dados antigos deste navegador estão inválidos e não foram importados.");
          }
          if (legacyData && window.confirm("Encontramos dados de saúde antigos neste navegador. Deseja importá-los para esta conta segura?")) {
            const { error: importError } = await supabase.from("user_data").upsert(
              { user_id: userId, data: legacyData, updated_at: new Date().toISOString() },
              { onConflict: "user_id" },
            );
            if (importError) throw importError;
            accountData = legacyData;
            try {
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch (error) {
              console.error("Os dados foram importados, mas não foi possível limpar a cópia local.", error);
              notify("Dados importados. A cópia antiga permaneceu neste navegador.");
            }
          }
        }
      }
      if (!accountData.patient.name) {
        accountData.patient.name =
          nextSession.user.user_metadata.full_name ?? nextSession.user.user_metadata.name ?? "";
      }
      if (activeUserId.current !== userId) return;
      setData(accountData);
      setReadyUserId(userId);
      setSaveStatus("Dados carregados da sua conta.");
      loadingUserId.current = "";
    } catch (error) {
      if (activeUserId.current !== userId) return;
      loadingUserId.current = "";
      setReadyUserId("");
      setAuthMessage(
        `Não foi possível acessar seus dados: ${error instanceof Error ? error.message : "erro inesperado"}. Confira a tabela user_data e as políticas RLS no README.`,
      );
      setSaveStatus("");
    }
  }, [notify, readyUserId]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) void loadAccount(nextSession);
    });
    void supabase.auth.getSession().then(({ data: result, error }) => {
      if (!active) return;
      if (error) setAuthMessage(`Não foi possível verificar a sessão: ${error.message}`);
      else void loadAccount(result.session);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
      window.clearTimeout(toastTimer.current);
    };
  }, [loadAccount]);

  useEffect(() => {
    const userId = session?.user.id;
    const client = supabase;
    if (!client || !userId || readyUserId !== userId) return;
    const currentRevision = ++revision.current;
    const timer = window.setTimeout(() => {
      const snapshot = JSON.parse(JSON.stringify(data)) as ZeloData;
      setSaveStatus("Salvando na sua conta…");
      saveQueue.current = saveQueue.current.then(async () => {
        if (activeUserId.current !== userId || currentRevision !== revision.current) return;
        const { error } = await client.from("user_data").upsert(
          { user_id: userId, data: snapshot, updated_at: new Date().toISOString() },
          { onConflict: "user_id" },
        );
        if (error) throw error;
        if (activeUserId.current === userId && currentRevision === revision.current) {
          setSaveStatus(`Salvo na nuvem às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date())}.`);
        }
      }).catch((error: unknown) => {
        if (activeUserId.current === userId) {
          setSaveStatus(`Falha ao salvar: ${error instanceof Error ? error.message : "erro inesperado"}.`);
        }
      });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [data, readyUserId, session?.user.id]);

  async function login(email: string, password: string) {
    if (!supabase) throw new Error("Supabase não está configurado.");
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } finally {
      setAuthBusy(false);
    }
  }

  async function signup(name: string, email: string, password: string) {
    if (!supabase) throw new Error("Supabase não está configurado.");
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: authRedirectUrl,
        },
      });
      if (error) throw error;
    } finally {
      setAuthBusy(false);
    }
  }

  async function loginWithGoogle() {
    if (!supabase) throw new Error("Supabase não está configurado.");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: authRedirectUrl },
    });
    if (error) throw error;
  }

  async function resetPassword(email: string) {
    if (!supabase) throw new Error("Supabase não está configurado.");
    if (!email) throw new Error("Informe seu e-mail para receber o link de redefinição.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl,
    });
    if (error) throw error;
  }

  async function resendConfirmation(email: string) {
    if (!supabase) throw new Error("Supabase não está configurado.");
    if (!email) throw new Error("Informe seu e-mail para receber um novo link.");
    setAuthBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: authRedirectUrl },
      });
      if (error) throw error;
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      notify(`Não foi possível sair da conta: ${error.message}`);
      return;
    }
    activeUserId.current = "";
    loadingUserId.current = "";
    setData(emptyData());
    setDialog({ kind: "closed" });
  }

  function savePatient(patient: Patient) {
    setData((current) => ({ ...current, patient }));
    notify("Seu perfil foi salvo na sua conta.");
  }

  function saveMedication(draft: MedicationDraft) {
    const previous = draft.id ? data.medications.find((item) => item.id === draft.id) : undefined;
    if (!draft.name.trim() || !draft.dose.trim() || !draft.treatment.trim()) {
      notify("Confira o nome, a dose e a duração do tratamento.");
      return;
    }
    if (!draft.times.length || draft.times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      notify("Informe horários válidos no formato HH:MM.");
      return;
    }
    if (!Number.isFinite(draft.quantity) || draft.quantity < 0 || !Number.isFinite(draft.unitsPerDose) || draft.unitsPerDose <= 0) {
      notify("Confira a quantidade em estoque e as unidades por tomada.");
      return;
    }
    const medication: Medication = {
      ...draft,
      id: previous?.id ?? crypto.randomUUID(),
      initialQuantity: previous?.initialQuantity ?? draft.quantity,
      treatmentEnd: treatmentEndDate(draft.treatment, draft.startDate),
    };
    setData((current) => ({
      ...current,
      medications: previous
        ? current.medications.map((item) => item.id === previous.id ? medication : item)
        : [...current.medications, medication],
    }));
    setDialog({ kind: "closed" });
    notify(previous ? "Medicamento atualizado." : "Medicamento adicionado à sua rotina.");
  }

  function saveAppointment(draft: AppointmentDraft) {
    if (!draft.title.trim() || !draft.date) {
      notify("Informe o nome e a data da consulta.");
      return;
    }
    const previous = draft.id ? data.appointments.find((item) => item.id === draft.id) : undefined;
    const appointment: Appointment = { ...draft, id: previous?.id ?? crypto.randomUUID() };
    setData((current) => ({
      ...current,
      appointments: previous
        ? current.appointments.map((item) => item.id === previous.id ? appointment : item)
        : [...current.appointments, appointment],
    }));
    setSelectedDate(appointment.date);
    const parsedDate = new Date(`${appointment.date}T12:00:00`);
    setVisibleMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1));
    setDialog({ kind: "closed" });
    notify(previous ? "Consulta atualizada no calendário." : "Consulta adicionada ao calendário.");
  }

  function selectDate(date: string) {
    setSelectedDate(date);
    const parsed = new Date(`${date}T12:00:00`);
    setVisibleMonth(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
  }

  function toggleDose(medication: Medication, time: string) {
    const date = todayKey();
    const existing = data.logs.find((log): log is Extract<HealthLog, { type: "dose" }> => log.type === "dose" && log.medId === medication.id && log.date === date && log.time === time);
    if (!existing && medication.quantity < medication.unitsPerDose) {
      notify("Estoque insuficiente para registrar esta tomada.");
      return;
    }
    setData((current) => {
      const currentMedication = current.medications.find((item) => item.id === medication.id);
      if (!currentMedication) return current;
      if (existing) {
        return {
          ...current,
          medications: current.medications.map((item) => item.id === medication.id ? { ...item, quantity: Number((item.quantity + existing.units).toFixed(2)) } : item),
          logs: current.logs.filter((log) => log.id !== existing.id),
        };
      }
      const log: HealthLog = { id: crypto.randomUUID(), type: "dose", medId: medication.id, medName: medication.name, date, time, units: medication.unitsPerDose, unit: medication.unit };
      return {
        ...current,
        medications: current.medications.map((item) => item.id === medication.id ? { ...item, quantity: Number((item.quantity - item.unitsPerDose).toFixed(2)) } : item),
        logs: [...current.logs, log],
      };
    });
    notify(existing ? `Tomada das ${time} desmarcada; estoque ajustado.` : `Tomada das ${time} registrada. Muito bem!`);
  }

  function refillMedication(medication: Medication) {
    const response = window.prompt(`Quantas unidades de ${medication.unit} deseja adicionar ao estoque de ${medication.name}?`);
    if (response === null) return;
    const amount = Number(response.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      notify("Informe uma quantidade maior que zero.");
      return;
    }
    const log: HealthLog = { id: crypto.randomUUID(), type: "refill", medId: medication.id, medName: medication.name, date: todayKey(), amount, unit: medication.unit };
    setData((current) => ({
      ...current,
      medications: current.medications.map((item) => item.id === medication.id
        ? { ...item, quantity: Number((item.quantity + amount).toFixed(2)), initialQuantity: item.initialQuantity + amount }
        : item),
      logs: [...current.logs, log],
    }));
    notify("Reposição registrada no estoque e no histórico.");
  }

  function deleteMedication(medication: Medication) {
    if (!window.confirm(`Remover ${medication.name} e os registros de tomadas associados?`)) return;
    setData((current) => ({
      ...current,
      medications: current.medications.filter((item) => item.id !== medication.id),
      logs: current.logs.filter((log) => log.medId !== medication.id),
    }));
    notify("Medicamento removido.");
  }

  function deleteAppointment(appointment: Appointment) {
    if (!window.confirm("Remover esta consulta do calendário e do histórico?")) return;
    setData((current) => ({ ...current, appointments: current.appointments.filter((item) => item.id !== appointment.id) }));
    notify("Consulta removida do calendário.");
  }

  async function findMedicationImage(medication: Medication) {
    try {
      const image = await searchMedicationImage(medication.name);
      setData((current) => ({
        ...current,
        medications: current.medications.map((item) => item.id === medication.id ? { ...item, image } : item),
      }));
      notify("Imagem ilustrativa encontrada. Confira a embalagem; ela pode não corresponder ao medicamento.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Não foi possível buscar uma imagem.");
    }
  }

  if (!session || readyUserId !== session.user.id) {
    return (
      <AuthScreen
        configured={isSupabaseConfigured}
        googleEnabled={isGoogleAuthEnabled}
        busy={authBusy}
        initialMessage={authMessage}
        onLogin={login}
        onSignup={signup}
        onGoogle={loginWithGoogle}
        onResetPassword={resetPassword}
        onResendConfirmation={resendConfirmation}
      />
    );
  }

  return (
    <AppShell view={view} onNavigate={setView} onSignOut={() => void signOut()} patientName={data.patient.name} patientAvatar={data.patient.avatarDataUrl} saveStatus={saveStatus}>
      {saveStatus.startsWith("Falha ao salvar") && <div className="notice notice-error" role="alert">{saveStatus}</div>}
      {notice && <div className="toast" role="status" aria-live="polite">{notice}</div>}
      {view === "inicio" && <Dashboard patient={data.patient} medications={data.medications} appointments={data.appointments} logs={data.logs} onAddMedication={() => setDialog({ kind: "new-medication", date: todayKey() })} onAddAppointment={() => setDialog({ kind: "new-appointment", date: todayKey() })} onToggleDose={toggleDose} />}
      {view === "medicamentos" && <MedicationsView medications={data.medications} patientName={data.patient.name} onAdd={() => setDialog({ kind: "new-medication", date: todayKey() })} onEdit={(medication) => setDialog({ kind: "edit-medication", medication })} onDelete={deleteMedication} onRefill={refillMedication} onFindImage={findMedicationImage} />}
      {view === "calendario" && <CalendarView appointments={data.appointments} medications={data.medications} selectedDate={selectedDate} visibleMonth={visibleMonth} onSelectDate={selectDate} onChangeMonth={setVisibleMonth} onAddAppointment={(date) => setDialog({ kind: "new-appointment", date })} onEditAppointment={(appointment) => setDialog({ kind: "edit-appointment", appointment })} onDeleteAppointment={deleteAppointment} onAddMedication={(date) => setDialog({ kind: "new-medication", date })} onEditMedication={(medication) => setDialog({ kind: "edit-medication", medication })} />}
      {view === "relatorios" && <ReportsView medications={data.medications} appointments={data.appointments} logs={data.logs} />}
      {view === "perfil" && <ProfileView patient={data.patient} onSave={savePatient} />}
      {dialog.kind !== "closed" && (dialog.kind === "new-medication" || dialog.kind === "edit-medication") && (
        <MedicationDialog
          key={dialog.kind === "edit-medication" ? dialog.medication.id : `new-${dialog.date}`}
          open
          medication={dialog.kind === "edit-medication" ? dialog.medication : null}
          startDate={dialog.kind === "new-medication" ? dialog.date : dialog.medication.startDate}
          onClose={() => setDialog({ kind: "closed" })}
          onSave={saveMedication}
        />
      )}
      {dialog.kind !== "closed" && (dialog.kind === "new-appointment" || dialog.kind === "edit-appointment") && (
        <AppointmentDialog
          key={dialog.kind === "edit-appointment" ? dialog.appointment.id : `new-${dialog.date}`}
          open
          appointment={dialog.kind === "edit-appointment" ? dialog.appointment : null}
          date={dialog.kind === "new-appointment" ? dialog.date : dialog.appointment.date}
          onClose={() => setDialog({ kind: "closed" })}
          onSave={saveAppointment}
        />
      )}
    </AppShell>
  );
}

export default App;
