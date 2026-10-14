export default function ShareNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 text-center shadow-soft">
        <h1 className="text-xl font-semibold tracking-tight">This link is not available</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have expired or been turned off. Ask the person who sent it for a new one.</p>
      </div>
    </div>
  );
}
