import { AppSidebar } from "@/components/AppSidebar";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:pb-10 md:pl-[calc(72px+1.5rem)]">{children}</main>
    </div>
  );
}
