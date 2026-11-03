import type { Language } from "../types/language.type.js";

const RIYADH = "Asia/Riyadh";

function locale(language: Language): string {
  return language === "ar" ? "ar" : "en";
}

function riyadhDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: RIYADH,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function previousDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  return riyadhDay(new Date(Date.UTC(year, month - 1, date - 1, 12)));
}

export function formatClock(iso: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: RIYADH,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    numberingSystem: "latn",
  }).format(new Date(iso));
}

/** Clock for today, "yesterday" for the day before, otherwise a short date. */
export function formatConversationTime(
  iso: string,
  language: Language,
  now = new Date(),
): string {
  const day = riyadhDay(new Date(iso));
  const today = riyadhDay(now);
  if (day === today) return formatClock(iso, language);
  if (day === previousDay(today)) return language === "ar" ? "أمس" : "Yesterday";
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: RIYADH,
    day: "numeric",
    month: "short",
    numberingSystem: "latn",
  }).format(new Date(iso));
}

export function formatLongDate(isoDay: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: RIYADH,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    numberingSystem: "latn",
  }).format(new Date(`${isoDay}T12:00:00+03:00`));
}

export function formatDeliveryDate(isoDay: string, language: Language): string {
  return new Intl.DateTimeFormat(locale(language), {
    timeZone: RIYADH,
    weekday: "long",
    day: "numeric",
    month: "long",
    numberingSystem: "latn",
  }).format(new Date(`${isoDay}T12:00:00+03:00`));
}
