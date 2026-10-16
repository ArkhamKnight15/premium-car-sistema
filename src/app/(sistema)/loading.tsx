export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando">
      <div className="h-7 w-52 animate-pulse rounded-md bg-ink-850" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-ink-900" />)}
      </div>
      <div className="h-72 animate-pulse rounded-xl bg-ink-900" />
    </div>
  );
}
