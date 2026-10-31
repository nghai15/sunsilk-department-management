import { NAV_ITEMS } from './navItems';

interface Props { active: string; onNavigate: (key: string) => void }

export default function Sidebar({ active, onNavigate }: Props) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white md:block">
      <div className="px-4 py-5 text-base font-semibold text-slate-900">Quản lý nhà trọ</div>
      <nav aria-label="Điều hướng chính" className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map((i) => (
          <button
            key={i.key}
            onClick={() => onNavigate(i.key)}
            aria-current={active === i.key ? 'page' : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
              active === i.key ? 'bg-teal-50 font-semibold text-teal-800' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}
