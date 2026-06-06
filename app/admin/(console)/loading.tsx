export default function ConsoleLoading() {
  return (
    <div className="mx-auto max-w-5xl px-8 py-24 md:py-32">
      <div className="mb-20 h-20 w-2/3 max-w-md animate-pulse rounded-2xl bg-white/[0.05]" />
      <div className="mb-24 grid grid-cols-2 gap-5 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-3xl glass" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl glass" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}
