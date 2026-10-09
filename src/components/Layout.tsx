import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAppState } from '../state/context';

const NAV = [
  { to: '/verbeteringen', label: 'Verbeteringen' },
  { to: '/processen', label: 'Processen' },
  { to: '/geleerd', label: 'Geleerd' },
  { to: '/instellingen', label: 'Instellingen' },
];

function Banner() {
  const { settings, keyPresent, loadError } = useAppState();
  if (loadError) {
    return (
      <div className="border-b border-red-200 bg-red-50 px-6 py-2 text-sm text-red-800">{loadError}</div>
    );
  }
  if (!settings) return null;
  let text: string | null = null;
  if (!keyPresent) text = 'Er is nog geen API-sleutel ingesteld. AI-functies werken pas na het instellen.';
  else if (!settings.aiConsent) text = 'AI-functies staan uit. Je kunt ze aanzetten in Instellingen.';
  if (!text) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between border-b border-amber-200 bg-amber-50 px-6 py-2 text-sm text-amber-900"
    >
      <span>{text}</span>
      <Link to="/instellingen" className="font-medium underline">
        Naar Instellingen
      </Link>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex h-full">
      <nav
        aria-label="Hoofdnavigatie"
        className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4"
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src="/icon.png" alt="" className="h-6 w-6" />
          <span className="text-lg font-semibold text-brand-800">Verbeterlus</span>
        </div>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium ${
                isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <Banner />
        <main className="flex-1 overflow-auto p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
