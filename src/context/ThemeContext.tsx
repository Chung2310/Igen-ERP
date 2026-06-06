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
  if (typeof window === "undefined") return "light";
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
  };

  const toggleTheme = () => {
    setThemeState(prev => (prev === "light" ? "dark" : "light"));
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
