import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "chula:theme";

function readSavedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

function systemTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => readSavedTheme() ?? systemTheme());

  // Push to <html data-theme="..."> on every change
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);

  // Follow system preference if the user hasn't explicitly chosen
  useEffect(() => {
    if (readSavedTheme()) return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      if (readSavedTheme()) return;
      setThemeState(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = (t: Theme) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Safari private mode may throw
    }
    setThemeState(t);
  };

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "light" ? "dark" : "light"),
  };
}
