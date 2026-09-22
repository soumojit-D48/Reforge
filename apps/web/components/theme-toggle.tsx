"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";

export function ThemeToggle(): React.JSX.Element {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = (): void => {
    const nextDark = !dark;
    setDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    document.documentElement.style.colorScheme = nextDark ? "dark" : "light";
    window.localStorage.setItem("reforge-theme", nextDark ? "dark" : "light");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="theme-toggle"
      onClick={toggle}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}
