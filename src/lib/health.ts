import type {
  Appointment,
  GenderIdentity,
  HealthLog,
  Medication,
  Patient,
  ReminderTone,
  ZeloData,
} from "../types";

export const LEGACY_STORAGE_KEY = "bem-me-quer.v1";

export function emptyData(): ZeloData {
  return {
    patient: {
      name: "",
      gender: "",
      dob: "",
      address: "",
      conditions: "",
      avatarDataUrl: "",
      whatsappPhone: "",
      whatsappOptIn: false,
      reminderTone: "carinhoso",
      reminderMessage: "",
    },
    medications: [],
    appointments: [],
    logs: [],
  };
}

export function normalizeData(input: unknown): ZeloData {
  if (!input || typeof input !== "object") {
    throw new Error("Os dados salvos não têm o formato esperado.");
  }
  const parsed = input as Partial<ZeloData>;
  const savedTone = parsed.patient?.reminderTone;
  const reminderTone: ReminderTone =
    savedTone === "atencao" || savedTone === "familiar" || savedTone === "personalizado"
      ? savedTone
      : "carinhoso";
  return {
    patient: {
      ...emptyData().patient,
      ...(parsed.patient ?? {}),
      avatarDataUrl: typeof parsed.patient?.avatarDataUrl === "string" ? parsed.patient.avatarDataUrl : "",
      whatsappPhone: typeof parsed.patient?.whatsappPhone === "string" ? parsed.patient.whatsappPhone : "",
      whatsappOptIn: parsed.patient?.whatsappOptIn === true,
      reminderTone,
      reminderMessage: typeof parsed.patient?.reminderMessage === "string" ? parsed.patient.reminderMessage : "",
    },
    medications: Array.isArray(parsed.medications) ? parsed.medications : [],
    appointments: Array.isArray(parsed.appointments) ? parsed.appointments : [],
    logs: Array.isArray(parsed.logs) ? parsed.logs : [],
  };
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDate(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(date: Date, count: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() + count);
  return result;
}

export function formatDate(
  key: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
): string {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", options).format(parseDate(key));
}

export function ageFor(dob: string): string {
  if (!dob || !/^\d{4}-\d{2}-\d{2}$/.test(dob)) return "";
  const birth = parseDate(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? `${age} anos` : "";
}

export function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toLocaleUpperCase("pt-BR"))
      .join("") || "♡"
  );
}

export function greetingFor(patient: Patient, now = new Date()): {
  message: string;
  caption: string;
} {
  const hour = now.getHours();
  const greeting = hour >= 5 && hour < 12 ? "Bom dia" : hour >= 12 && hour < 18 ? "Boa tarde" : "Boa noite";
  const firstName = patient.name.trim().split(/\s+/)[0] || "pessoa querida";
  const masculine = patient.gender === "homem" || patient.gender === "homem-trans";
  const feminine = patient.gender === "mulher" || patient.gender === "mulher-trans";
  const caption = masculine
    ? "Seja muito bem-vindo. Um passo de cada vez, no seu tempo."
    : feminine
      ? "Seja muito bem-vinda. Um passo de cada vez, no seu tempo."
      : "Que bom ter você por aqui. Um passo de cada vez, no seu tempo.";
  return { message: `${greeting}, ${firstName}`, caption };
}

export function treatmentDays(treatment: string): number | null {
  const text = treatment.trim().toLocaleLowerCase("pt-BR");
  if (/cont[ií]nu|indefin|cr[oô]nic/.test(text)) return null;
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(dia|d|semana|semanas|m[eê]s|meses|ano|anos)/i);
  if (!match) return null;
  const amount = Number(match[1].replace(",", "."));
  const unit = match[2].toLocaleLowerCase("pt-BR");
  const multiplier = unit.startsWith("d")
    ? 1
    : unit.startsWith("sem")
      ? 7
      : unit.startsWith("m")
        ? 30.4375
        : 365.25;
  return Math.max(1, Math.ceil(amount * multiplier));
}

export function treatmentEndDate(treatment: string, startDate: string): string {
  const days = treatmentDays(treatment);
  return days ? todayKey(addDays(parseDate(startDate), days - 1)) : "";
}

export function medicationRate(medication: Medication): number {
  return medication.times.length * medication.unitsPerDose;
}

export function depletionFor(medication: Medication): { days: number; date: string } {
  const rate = medicationRate(medication);
  const stock = Math.max(0, medication.quantity);
  if (!rate || stock <= 0) return { days: 0, date: todayKey() };
  const days = Math.max(0, Math.ceil(stock / rate) - 1);
  const today = todayKey();
  const startDate =
    medication.startDate && medication.startDate > today
      ? parseDate(medication.startDate)
      : new Date();
  return { days, date: todayKey(addDays(startDate, days)) };
}

export function hasTaken(
  logs: HealthLog[],
  medicationId: string,
  date: string,
  time: string,
): boolean {
  return logs.some(
    (log) =>
      log.type === "dose" &&
      log.medId === medicationId &&
      log.date === date &&
      log.time === time,
  );
}

function expectedDosesInRange(medication: Medication, date: string): number {
  const startDate = medication.startDate || date;
  if (date < startDate || (medication.treatmentEnd && date > medication.treatmentEnd)) return 0;
  return medication.times.length;
}

export function adherenceForDate(
  medications: Medication[],
  logs: HealthLog[],
  date: string,
): { expected: number; taken: number } {
  const expected = medications.reduce(
    (total, medication) => total + expectedDosesInRange(medication, date),
    0,
  );
  const taken = logs.filter((log) => log.type === "dose" && log.date === date).length;
  return { expected, taken };
}

export function asPatient(input: Partial<Patient>): Patient {
  return {
    name: input.name ?? "",
    gender: (input.gender ?? "") as GenderIdentity,
    dob: input.dob ?? "",
    address: input.address ?? "",
    conditions: input.conditions ?? "",
    avatarDataUrl: input.avatarDataUrl ?? "",
    whatsappPhone: input.whatsappPhone ?? "",
    whatsappOptIn: input.whatsappOptIn ?? false,
    reminderTone: input.reminderTone ?? "carinhoso",
    reminderMessage: input.reminderMessage ?? "",
  };
}

const reminderMessages: Record<Exclude<ReminderTone, "personalizado">, string> = {
  carinhoso: "Lembrete do Zelo: chegou a hora de cuidar de você, {nome}. Está na hora de tomar {medicamentos}. {estoque}",
  atencao: "Atenção, {nome}: chegou a hora de tomar {medicamentos}. {estoque}",
  familiar: "Olá, {nome}! Está na hora dos seus remédios: {medicamentos}. {estoque}",
};

export function reminderNotification(
  patient: Patient,
  medications: Medication[],
  time: string,
): { title: string; body: string } {
  const tone = patient.reminderTone || "carinhoso";
  const title =
    tone === "atencao"
      ? "🔔 Lembrete importante"
      : tone === "familiar"
        ? "♡ Um lembrete com carinho"
        : "🌿 Um cuidado para você";
  const moment = Number(time.slice(0, 2)) < 12 ? "manhã" : Number(time.slice(0, 2)) < 18 ? "tarde" : "noite";
  const medicationNames = medications
    .map((medication) => `${medication.name}${medication.dose ? ` (${medication.dose})` : ""}`)
    .join(", ");
  const lowStock = medications
    .filter((medication) => depletionFor(medication).days <= 3)
    .map((medication) => {
      const days = depletionFor(medication).days;
      return `O estoque de ${medication.name} pode acabar ${days === 0 ? "hoje" : `em ${days} dia${days === 1 ? "" : "s"}`}.`;
    });
  const stockMessage = lowStock.join(" ");
  const template =
    tone === "personalizado"
      ? patient.reminderMessage
      : reminderMessages[tone];
  const body = template
    .replaceAll("{nome}", patient.name.trim() || "você")
    .replaceAll("{momento}", moment)
    .replaceAll("{medicamentos}", medicationNames)
    .replaceAll("{estoque}", stockMessage)
    .replace(/\s+/g, " ")
    .trim();
  return { title, body: body || `${medicationNames} · ${time}` };
}

export function appointmentForDate(appointments: Appointment[], date: string): Appointment[] {
  return appointments.filter((appointment) => appointment.date === date);
}
