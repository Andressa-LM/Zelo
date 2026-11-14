import type { Medication } from "../types";

const GEMINI_MODEL = "gemini-2.5-flash";

export async function searchMedicationImage(name: string): Promise<string> {
  const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
  endpoint.search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${name} medicamento embalagem`,
    gsrnamespace: "6",
    gsrlimit: "1",
    prop: "imageinfo",
    iiprop: "url",
    iiurlwidth: "320",
    format: "json",
    origin: "*",
  }).toString();
  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`O serviço de imagens respondeu com status ${response.status}.`);
  const result: { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> } } =
    await response.json();
  const page = Object.values(result.query?.pages ?? {})[0];
  const image = page?.imageinfo?.[0]?.thumburl || page?.imageinfo?.[0]?.url;
  if (!image || !/^https:\/\//i.test(image)) throw new Error("Nenhuma imagem disponível para esta busca.");
  return image;
}

function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo de imagem."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      if (comma < 0) reject(new Error("O arquivo não pôde ser convertido para leitura."));
      else resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export async function readPrescriptionWithGemini(
  text: string,
  imageFile: File | undefined,
  apiKey: string,
): Promise<Partial<Medication>> {
  const parts: Array<Record<string, unknown>> = [
    {
      text: `Leia a receita médica fornecida e extraia somente informações explicitamente presentes. Não deduza nem sugira posologia. Responda em JSON com os campos name (string), dose (string), times (array de horários 24h HH:MM), unitsPerDose (número apenas se inequívoco, caso contrário null), quantity (número apenas se indicado, caso contrário null), unit (uma de comprimidos, cápsulas, mL, mg, gotas, unidades, somente se indicada), treatment (string). Use string vazia, array vazio ou null para campos ausentes. Preserve o texto da dose sem reinterpretar. O usuário deve confirmar os resultados com a receita e seu profissional de saúde. Texto da receita: ${text || "Consulte a imagem anexada."}`,
    },
  ];
  if (imageFile) {
    parts.push({
      inline_data: { mime_type: imageFile.type, data: await fileAsBase64(imageFile) },
    });
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { responseMimeType: "application/json" } }),
    },
  );
  const result: {
    error?: { message?: string };
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } = await response.json();
  if (!response.ok) throw new Error(result.error?.message || `O serviço respondeu com status ${response.status}.`);
  const raw = result.candidates?.[0]?.content?.parts?.find((part) => part.text)?.text;
  if (!raw) throw new Error("A resposta do serviço não continha dados para preencher.");
  return JSON.parse(raw) as Partial<Medication>;
}

