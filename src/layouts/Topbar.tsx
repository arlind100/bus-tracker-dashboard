import { useState } from 'react';
import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

function initials(name?: string | null, email?: string | null): string {
  const src = (name || email || '?').trim();
  const parts = src.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Topbar({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onOpenSidebar}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="text-right leading-tight">
            <p className="max-w-[180px] truncate text-sm font-medium text-foreground">
              {user?.displayName || user?.email || 'Admin'}
            </p>
            <div className="flex items-center justify-end">
              {user?.isSuperAdmin ? (
                <Badge variant="default" className="mt-0.5">Super Admin</Badge>
              ) : (
                <Badge variant="neutral" className="mt-0.5">Admin</Badge>
              )}
            </div>
          </div>
          <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary ring-1 ring-inset ring-primary/20">
            {initials(user?.displayName, user?.email)}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleLogout}
          disabled={signingOut}
        >
          <LogOut className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
