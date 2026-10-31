import Sidebar from './Sidebar';
import BottomNavigation from './BottomNavigation';

interface Props {
  active: string;
  onNavigate: (key: string) => void;
  children: React.ReactNode;
}

export default function AppLayout({ active, onNavigate, children }: Props) {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={active} onNavigate={onNavigate} />
      <main className="min-w-0 flex-1 pb-20 md:pb-0">{children}</main>
      <BottomNavigation active={active} onNavigate={onNavigate} />
    </div>
  );
}
