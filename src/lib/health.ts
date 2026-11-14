import type {
  Appointment,
  GenderIdentity,
  HealthLog,
  Medication,
  Patient,
  ZeloData,
} from "../types";

export const LEGACY_STORAGE_KEY = "bem-me-quer.v1";
export const WHATSAPP_NUMBER = "5521972717327";

export function emptyData(): ZeloData {
  return {
    patient: { name: "", gender: "", dob: "", address: "", conditions: "", avatarDataUrl: "" },
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
  return {
    patient: {
      ...emptyData().patient,
      ...(parsed.patient ?? {}),
      avatarDataUrl: typeof parsed.patient?.avatarDataUrl === "string" ? parsed.patient.avatarDataUrl : "",
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

export function whatsappUrl(patientName: string, medication: Medication): string {
  const name = patientName.trim() || "você";
  const message = `Olá! O estoque do remédio ${medication.name} de ${name} vai acabar em breve. É hora de providenciar a compra na farmácia.`;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export function parsePrescriptionText(text: string): {
  name?: string;
  times: string[];
  treatment?: string;
} {
  const labeledMedication = text.match(/(?:medicamento|rem[eé]dio)\s*:\s*([^\n,;.]{2,100})/i);
  const instructedMedication = text.match(
    /\b(?:tomar|usar)\s+(?:o|a)?\s*([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]*)\s+(?=\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|comprimidos?|c[aá]psulas?|gotas?)\b)/i,
  );
  const name = (labeledMedication?.[1] || instructedMedication?.[1] || "")
    .replace(/\s+\d+(?:[.,]\d+)?\s*(?:mg|mcg|µg|g|ml|comprimidos?|c[aá]psulas?|gotas?)\b.*$/i, "")
    .trim();
  const times = [
    ...new Set(
      [...text.matchAll(/\b(?:às|as)\s+([01]?\d|2[0-3])(?::([0-5]\d)|h([0-5]\d)?)?/gi)].map(
        (match) => `${match[1].padStart(2, "0")}:${(match[2] || match[3] || "00").padStart(2, "0")}`,
      ),
    ),
  ];
  const duration = text.match(
    /(?:por|durante|dura[cç][aã]o\s*:?)\s*(\d+\s*(?:dias?|semanas?|meses?|anos?))/i,
  );
  return { ...(name ? { name } : {}), times, ...(duration ? { treatment: duration[1] } : {}) };
}

export function asPatient(input: Partial<Patient>): Patient {
  return {
    name: input.name ?? "",
    gender: (input.gender ?? "") as GenderIdentity,
    dob: input.dob ?? "",
    address: input.address ?? "",
    conditions: input.conditions ?? "",
    avatarDataUrl: input.avatarDataUrl ?? "",
  };
}

export function appointmentForDate(appointments: Appointment[], date: string): Appointment[] {
  return appointments.filter((appointment) => appointment.date === date);
}
