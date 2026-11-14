export type GenderIdentity =
  | ""
  | "homem"
  | "mulher"
  | "homem-trans"
  | "mulher-trans"
  | "genero-fluido"
  | "outra"
  | "nao-informar";

export type Patient = {
  name: string;
  gender: GenderIdentity;
  dob: string;
  address: string;
  conditions: string;
  avatarDataUrl: string;
};

export type Medication = {
  id: string;
  name: string;
  dose: string;
  times: string[];
  quantity: number;
  initialQuantity: number;
  unitsPerDose: number;
  unit: string;
  treatment: string;
  startDate: string;
  treatmentEnd: string;
  image: string;
};

export type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  notes: string;
};

export type DoseLog = {
  id: string;
  type: "dose";
  medId: string;
  medName: string;
  date: string;
  time: string;
  units: number;
  unit: string;
};

export type RefillLog = {
  id: string;
  type: "refill";
  medId: string;
  medName: string;
  date: string;
  amount: number;
  unit: string;
};

export type HealthLog = DoseLog | RefillLog;

export type ZeloData = {
  patient: Patient;
  medications: Medication[];
  appointments: Appointment[];
  logs: HealthLog[];
};

export type AuthMode = "login" | "signup";
export type ViewName =
  | "inicio"
  | "medicamentos"
  | "calendario"
  | "relatorios"
  | "perfil";

export type MedicationDraft = Omit<Medication, "id" | "initialQuantity" | "treatmentEnd"> & {
  id?: string;
};

export type AppointmentDraft = Omit<Appointment, "id"> & { id?: string };
