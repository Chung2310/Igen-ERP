import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";

interface ThemeContextType {
  theme: ThemeMode;
  dark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = "igenerp-theme-mode";

const getInitialTheme = (): ThemeMode => {
  // Dark-mode detection/commented out — force light mode by default
  // if (typeof window === "undefined") return "light";
  // const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  // if (savedTheme === "dark" || savedTheme === "light") {
  //   return savedTheme;
  // }
  // const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  // return prefersDark ? "dark" : "light";
  return "light";
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    // Disable dynamic dark-mode class toggling and enforce light theme
    const root = document.documentElement;
    // root.classList.toggle("dark", false);
    root.classList.remove("dark");
    root.setAttribute("data-theme", "light");
    root.style.colorScheme = "light";
    // Keep localStorage but always store light for compatibility
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    } catch {}
  }, []);

  const setTheme = (_mode: ThemeMode) => {
    // No-op: dark mode disabled, keep light
    setThemeState("light");
  };

  const toggleTheme = () => {
    // No-op: dark mode disabled
    return;
  };

  const value = useMemo(
    () => ({ theme, dark: theme === "dark", toggleTheme, setTheme }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
