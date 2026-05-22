import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "chonburi:theme";

function readSavedTheme(): Theme | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : null;
}

function systemTheme(): Theme {
  // This dashboard is designed for dark mode — tactical dark palette, cyan
  // buildings on near-black basemap. Light mode exists as a toggle but dark
  // is the correct default regardless of OS preference.
  return "dark";
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => readSavedTheme() ?? systemTheme());

  // Push to <html data-theme="..."> on every change
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);

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
