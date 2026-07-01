import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button className="btn-secondary h-10 w-10 px-0" onClick={toggleTheme} title="Toggle theme" type="button">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
