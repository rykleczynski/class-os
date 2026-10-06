import { AppSidebar } from "@/components/AppSidebar";

export default function DashLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <AppSidebar />
      <div className="md:pl-56">
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-12 md:pt-10">{children}</main>
      </div>
    </div>
  );
}
