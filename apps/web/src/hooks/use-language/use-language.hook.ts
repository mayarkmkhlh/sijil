import { useEffect, useState } from "react";
import type { Language } from "../../lib/types/language.type.js";
import { copy, type Copy } from "./copy.js";

export function useLanguage(): {
  language: Language;
  dir: "rtl" | "ltr";
  setLanguage: (language: Language) => void;
  copy: Copy;
} {
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  return {
    language,
    dir: language === "ar" ? "rtl" : "ltr",
    setLanguage,
    copy: copy[language],
  };
}
