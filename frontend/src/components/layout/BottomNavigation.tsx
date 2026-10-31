import { NAV_ITEMS } from './navItems';

interface Props { active: string; onNavigate: (key: string) => void }

export default function BottomNavigation({ active, onNavigate }: Props) {
  return (
    <nav
      aria-label="Điều hướng chính"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map((i) => (
          <li key={i.key}>
            <button
              onClick={() => onNavigate(i.key)}
              aria-current={active === i.key ? 'page' : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
                active === i.key ? 'font-semibold text-teal-700' : 'text-slate-500'
              }`}
            >
              <span aria-hidden className="text-lg">{i.icon}</span>
              {i.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
