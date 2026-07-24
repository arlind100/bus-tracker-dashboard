import { NavLink } from 'react-router-dom';
import { Bus } from 'lucide-react';
import { NAV_SECTIONS } from '@/config/navigation';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useAuth();

  return (
    <aside className="flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
          <Bus className="size-4.5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-sidebar-foreground">Bus Tracker</p>
          <p className="text-[11px] font-medium text-muted-foreground">Super Admin</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(
            item => !item.superAdminOnly || user?.isSuperAdmin,
          );
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mt-5 first:mt-2">
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {section.title}
              </p>
              <ul className="flex flex-col gap-0.5">
                {items.map(item => (
                  <li key={item.path}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        cn(
                          'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-card text-primary shadow-sm'
                            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground',
                        )
                      }
                    >
                      <item.icon className="size-4.5 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
