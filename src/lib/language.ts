"use client";

import { useEffect, useState } from "react";

export type AppLanguage = "en" | "es";
const storageKey = "steadfast-language";

export function setAppLanguage(language: AppLanguage) {
  localStorage.setItem(storageKey, language);
  document.documentElement.lang = language;
  window.dispatchEvent(new CustomEvent("steadfast-language-change", { detail: language }));
}

export function useAppLanguage() {
  const [language, setLanguage] = useState<AppLanguage>("en");
  useEffect(() => {
    const selected: AppLanguage = localStorage.getItem(storageKey) === "es" ? "es" : "en";
    queueMicrotask(() => setLanguage(selected));
    document.documentElement.lang = selected;
    const changed = (event: Event) => setLanguage((event as CustomEvent<AppLanguage>).detail);
    window.addEventListener("steadfast-language-change", changed);
    return () => window.removeEventListener("steadfast-language-change", changed);
  }, []);
  return { language, spanish: language === "es", setLanguage: setAppLanguage };
}
