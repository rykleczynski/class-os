"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FlaskConical, GraduationCap, LayoutGrid, Layers } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const items = [
  { href: "/", label: "Overview", short: "Overview", icon: LayoutGrid },
  { href: "/course/econ-106f", label: "Courses", short: "Courses", icon: BookOpen },
  { href: "/lesson/econ106f-class3", label: "Latest lesson", short: "Lesson", icon: GraduationCap },
  { href: "/lesson/econ106f-class3?stage=flashcards", label: "Review", short: "Review", icon: Layers },
  { href: "/dev/blocks", label: "Block gallery", short: "Blocks", icon: FlaskConical },
];

/** Brand mark: a small coral cluster, echoing the Learnspring logo without copying it. */
function Mark() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 text-coral" aria-hidden>
      <rect x="1" y="1" width="8" height="8" rx="2.5" fill="currentColor" />
      <rect x="11" y="1" width="8" height="8" rx="4" fill="currentColor" opacity="0.55" />
      <rect x="1" y="11" width="8" height="8" rx="4" fill="currentColor" opacity="0.55" />
      <rect x="11" y="11" width="8" height="8" rx="2.5" fill="currentColor" />
    </svg>
  );
}

export function AppSidebar() {
  const path = usePathname();
  // Only "/" and "/course/*" render inside this layout, so the lesson links are never active here.
  const active = (href: string) => (href === "/" ? path === "/" : href.startsWith("/course") && path.startsWith("/course"));
  return (
    <>
      {/* Desktop: labeled nav */}
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar px-4 py-6 md:flex">
        <Link href="/" className="mb-8 flex items-center gap-2.5 rounded-xl px-3 py-1 text-lg font-bold tracking-tight">
          <Mark />
          <span>
            Class OS<span className="text-coral">.</span>
          </span>
        </Link>
        <ul className="space-y-1">
          {items.map(({ href, label, icon: Icon }) => {
            const on = active(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium transition-colors ${
                    on ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent"
                  }`}
                >
                  <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
        <ThemeToggle
          label="Light / dark"
          className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-[0.95rem] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        />
      </nav>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-sidebar-border bg-sidebar/95 px-1 pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur md:hidden"
      >
        {items.map(({ href, label, short, icon: Icon }) => {
          const on = active(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={on ? "page" : undefined}
              className={`flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[0.7rem] font-medium ${on ? "text-foreground" : "text-muted-foreground"}`}
            >
              <span className={`flex h-8 w-12 items-center justify-center rounded-full ${on ? "bg-sidebar-primary text-sidebar-primary-foreground" : ""}`}>
                <Icon className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.75} aria-hidden />
              </span>
              {short}
            </Link>
          );
        })}
        <ThemeToggle
          label="Theme"
          className="flex min-w-0 flex-1 flex-col items-center gap-0.5 text-[0.7rem] font-medium text-muted-foreground [&>svg]:my-[0.4rem]"
        />
      </nav>
    </>
  );
}
