import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { depletionFor, normalizeData, parseDate, todayKey } from "../src/lib/health";
import type { Medication, ZeloData } from "../src/types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const RETRY_WINDOW_MS = 3 * DAY_IN_MS;

function isMedication(value: unknown): value is Medication {
  if (!value || typeof value !== "object") return false;
  const medication = value as Partial<Medication>;
  return (
    typeof medication.id === "string" &&
    typeof medication.name === "string" &&
    typeof medication.quantity === "number" &&
    typeof medication.unitsPerDose === "number" &&
    Array.isArray(medication.times) &&
    medication.times.every((time) => typeof time === "string")
  );
}

function daysUntil(date: string, today: string): number {
  return Math.ceil((parseDate(date).getTime() - parseDate(today).getTime()) / DAY_IN_MS);
}

function sameSecret(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
}

async function sendTemplateMessage(
  phone: string,
  patientName: string,
  medicationName: string,
  accessToken: string,
  phoneNumberId: string,
  templateName: string,
  templateLanguage: string,
  apiVersion: string,
): Promise<{ ok: boolean; status: number; code?: number }> {
  let response: Response;
  try {
    response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{
            type: "body",
            parameters: [
              { type: "text", text: patientName || "você" },
              { type: "text", text: medicationName },
            ],
          }],
        },
      }),
    });
  } catch {
    return { ok: false, status: 0 };
  }

  if (response.ok) return { ok: true, status: response.status };
  let code: number | undefined;
  try {
    const body = await response.json() as { error?: { code?: number } };
    code = body.error?.code;
  } catch {
    console.error("A resposta de erro do WhatsApp não continha JSON.");
  }
  return { ok: false, status: response.status, ...(code ? { code } : {}) };
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!cronSecret || !sameSecret(authorization.replace(/^Bearer\s+/i, ""), cronSecret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || "pt_BR";
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION || "v27.0";
  if (!supabaseUrl || !serviceRoleKey || !accessToken || !phoneNumberId || !templateName) {
    return Response.json({ error: "A integração WhatsApp não está configurada por completo." }, { status: 503 });
  }
  if (!/^v\d+\.\d+$/.test(apiVersion)) {
    return Response.json({ error: "A versão configurada da API WhatsApp é inválida." }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const today = todayKey();
  const now = new Date();
  const summary = { accountsChecked: 0, remindersSent: 0, skipped: 0, errors: 0 };
  const pageSize = 100;

  for (let offset = 0; ; offset += pageSize) {
    const { data: rows, error } = await supabase
      .from("user_data")
      .select("user_id,data")
      .range(offset, offset + pageSize - 1);
    if (error) {
      console.error("Não foi possível consultar os dados para lembretes de reposição.", error.message);
      return Response.json({ error: "Falha ao consultar os dados de contas.", ...summary }, { status: 500 });
    }
    if (!rows?.length) break;

    for (const row of rows) {
      summary.accountsChecked += 1;
      let data: ZeloData;
      try {
        data = normalizeData(row.data);
      } catch (error) {
        summary.errors += 1;
        console.error("Uma conta tem dados inválidos para lembretes de reposição.", error);
        continue;
      }
      const { patient } = data;
      const phone = typeof patient.whatsappPhone === "string" ? patient.whatsappPhone.replace(/\D/g, "") : "";
      if (patient.whatsappOptIn !== true || !/^[1-9]\d{7,14}$/.test(phone)) {
        summary.skipped += 1;
        continue;
      }

      for (const medication of data.medications) {
        if (!isMedication(medication) || medication.whatsappAlertSentAt) {
          summary.skipped += 1;
          continue;
        }
        if (
          !medication.name.trim() ||
          !medication.times.length ||
          medication.times.some((time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
          !Number.isFinite(medication.quantity) ||
          !Number.isFinite(medication.unitsPerDose) ||
          medication.quantity < 0 ||
          medication.unitsPerDose <= 0 ||
          (medication.startDate && medication.startDate > today) ||
          (medication.treatmentEnd && medication.treatmentEnd < today)
        ) {
          summary.skipped += 1;
          continue;
        }
        const depletion = depletionFor(medication);
        if (daysUntil(depletion.date, today) > 3) {
          summary.skipped += 1;
          continue;
        }
        const previousAttempt = medication.whatsappAlertAttemptedAt
          ? Date.parse(medication.whatsappAlertAttemptedAt)
          : 0;
        if (previousAttempt && now.getTime() - previousAttempt < RETRY_WINDOW_MS) {
          summary.skipped += 1;
          continue;
        }

        medication.whatsappAlertAttemptedAt = now.toISOString();
        const { error: attemptError } = await supabase
          .from("user_data")
          .update({ data, updated_at: now.toISOString() })
          .eq("user_id", row.user_id);
        if (attemptError) {
          summary.errors += 1;
          console.error("Não foi possível registrar uma tentativa de lembrete.", attemptError.message);
          continue;
        }

        const result = await sendTemplateMessage(
          phone,
          typeof patient.name === "string" ? patient.name : "",
          medication.name,
          accessToken,
          phoneNumberId,
          templateName,
          templateLanguage,
          apiVersion,
        );
        if (!result.ok) {
          summary.errors += 1;
          console.error("O WhatsApp não aceitou um lembrete de reposição.", {
            status: result.status,
            code: result.code,
          });
          if (result.status > 0) {
            delete medication.whatsappAlertAttemptedAt;
            const { error: clearError } = await supabase
              .from("user_data")
              .update({ data, updated_at: new Date().toISOString() })
              .eq("user_id", row.user_id);
            if (clearError) {
              console.error("Não foi possível limpar o registro de tentativa recusada.", clearError.message);
            }
          }
          continue;
        }

        medication.whatsappAlertSentAt = now.toISOString();
        const { error: sentError } = await supabase
          .from("user_data")
          .update({ data, updated_at: now.toISOString() })
          .eq("user_id", row.user_id);
        if (sentError) {
          summary.errors += 1;
          console.error("A mensagem foi enviada, mas não foi possível registrar o envio.", sentError.message);
          continue;
        }
        summary.remindersSent += 1;
      }
    }
    if (rows.length < pageSize) break;
  }

  return Response.json(summary);
}
