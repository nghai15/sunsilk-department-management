interface Props { title: string; subtitle?: string; right?: React.ReactNode }

export default function Header({ title, subtitle, right }: Props) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="truncate text-sm text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
