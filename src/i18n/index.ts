import ko from "./ko";
import en from "./en";

const translations = { ko, en } as const;

export type Locale = keyof typeof translations;
export type TranslationKeys = typeof ko;

export function t(locale: Locale) {
  return translations[locale];
}

export function getLocaleFromUrl(url: URL): Locale {
  const [, lang] = url.pathname.split("/");
  if (lang === "en") return "en";
  return "ko";
}
