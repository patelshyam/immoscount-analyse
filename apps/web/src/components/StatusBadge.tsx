export function StatusBadge({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}
