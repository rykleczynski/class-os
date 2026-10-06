"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FlaskConical, LayoutDashboard, GraduationCap } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/course/econ-106f", label: "Courses", icon: BookOpen },
  { href: "/lesson/econ106f-class3", label: "Latest lesson", icon: GraduationCap },
  { href: "/dev/blocks", label: "Block gallery", icon: FlaskConical },
];

export function AppSidebar() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.split("/").slice(0, 2).join("/")));
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-sidebar-border bg-sidebar px-2 py-2 md:inset-y-0 md:left-0 md:right-auto md:w-[72px] md:flex-col md:justify-start md:gap-2 md:border-r md:border-t-0 md:py-5"
    >
      <Link href="/" aria-label="Class OS home" className="hidden h-10 w-10 items-center justify-center rounded-xl bg-foreground text-sm font-extrabold text-background md:mb-4 md:flex">
        C
      </Link>
      {items.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          aria-label={label}
          title={label}
          aria-current={active(href) ? "page" : undefined}
          className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
            active(href) ? "bg-foreground text-background" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          }`}
        >
          <Icon className="h-5 w-5" />
        </Link>
      ))}
      <ThemeToggle className="flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent hover:text-foreground md:mt-auto" />
    </nav>
  );
}
