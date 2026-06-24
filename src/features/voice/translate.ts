export type SpeechLang = "en" | "es" | "ru";

type LibreTranslateResponse = {
  translatedText?: string;
};

type MyMemoryResponse = {
  responseData?: {
    translatedText?: string;
  };
};

const LIBRE_SOURCE_BY_LANG: Record<SpeechLang, string> = {
  en: "en",
  es: "es",
  ru: "ru",
};

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 6000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/**
 * Best-effort speech translation to English.
 *
 * For `en`, this simply normalizes the recognized transcript.
 * For non-English input, it uses public translation endpoints with graceful
 * fallback to original text if translation is unavailable.
 */
export async function toEnglishFromSpeech(
  transcript: string,
  from: SpeechLang,
): Promise<string> {
  const sourceText = normalize(transcript);
  if (!sourceText) return "";
  if (from === "en") return sourceText;

  const source = LIBRE_SOURCE_BY_LANG[from];

  try {
    const response = await fetchWithTimeout(
      "https://libretranslate.com/translate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: sourceText,
          source,
          target: "en",
          format: "text",
        }),
      },
    );

    if (response.ok) {
      const data = (await response.json()) as LibreTranslateResponse;
      const translated = normalize(data.translatedText ?? "");
      if (translated) return translated;
    }
  } catch {
    // Fall through to secondary provider.
  }

  try {
    const params = new URLSearchParams({
      q: sourceText,
      langpair: `${source}|en`,
    });
    const response = await fetchWithTimeout(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
      undefined,
      7000,
    );
    if (response.ok) {
      const data = (await response.json()) as MyMemoryResponse;
      const translated = normalize(data.responseData?.translatedText ?? "");
      if (translated) return translated;
    }
  } catch {
    // Keep original transcript when external translation is unavailable.
  }

  return sourceText;
}
