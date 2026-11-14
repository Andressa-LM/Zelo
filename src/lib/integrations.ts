export type MedicationSuggestion = {
  id: string;
  name: string;
  concentration: string;
  presentation: string;
  manufacturer: string;
};

type FarmaBookHit = {
  id?: string;
  produto?: string;
  produtoResolvido?: string;
  concentracao?: string;
  apresentacaoDescritiva?: string;
  laboratorio?: string;
};

export async function searchMedicationSuggestions(
  query: string,
  signal?: AbortSignal,
): Promise<MedicationSuggestion[]> {
  const search = query.trim().slice(0, 100);
  if (search.length < 2) return [];

  const endpoint = new URL("https://api.farmabook.com.br/public/search");
  endpoint.search = new URLSearchParams({ q: search, limit: "6" }).toString();
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(7000)]) : AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`O catálogo respondeu com status ${response.status}.`);
  const result: { hits?: FarmaBookHit[] } = await response.json();
  return (result.hits ?? [])
    .filter((hit) => typeof hit.produtoResolvido === "string" || typeof hit.produto === "string")
    .map((hit, index) => ({
      id: hit.id || `${hit.produtoResolvido || hit.produto}-${hit.concentracao || index}`,
      name: hit.produtoResolvido || hit.produto || "",
      concentration: hit.concentracao || "",
      presentation: hit.apresentacaoDescritiva || "",
      manufacturer: hit.laboratorio || "",
    }));
}

export async function fetchMedicationImage(
  medicationName: string,
): Promise<{ imageUrl: string; isFallback: boolean }> {
  const name = medicationName.trim().slice(0, 120);
  if (!name) return { imageUrl: "", isFallback: true };

  try {
    const endpoint = new URL("https://commons.wikimedia.org/w/api.php");
    endpoint.search = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: `${name} medicamento`,
      gsrnamespace: "6",
      gsrlimit: "5",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "320",
      format: "json",
      origin: "*",
    }).toString();
    const response = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) return { imageUrl: "", isFallback: true };
    const result: { query?: { pages?: Record<string, { imageinfo?: { thumburl?: string; url?: string }[] }> } } =
      await response.json();
    const image = Object.values(result.query?.pages ?? {})
      .map((page) => page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url || "")
      .find((url) => /^https:\/\//i.test(url));
    return image ? { imageUrl: image, isFallback: false } : { imageUrl: "", isFallback: true };
  } catch {
    return { imageUrl: "", isFallback: true };
  }
}
