"use client";

import { SunMoon } from "lucide-react";

export function ThemeToggle({ className = "", label }: { className?: string; label?: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const isDark =
      root.getAttribute("data-theme") === "dark" ||
      (!root.getAttribute("data-theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    const next = isDark ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("classos:theme", next);
    } catch {
      /* ignore */
    }
  };
  return (
    <button type="button" onClick={toggle} aria-label="Toggle light or dark mode" className={className}>
      <SunMoon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden />
      {label && <span>{label}</span>}
    </button>
  );
}
