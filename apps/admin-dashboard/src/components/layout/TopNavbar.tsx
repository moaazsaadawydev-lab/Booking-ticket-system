import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth-context';
import { Badge } from '../ui/Badge';
import ThemeToggle from './ThemeToggle';
import { resolveImageUrl } from '../../lib/api-client';
import { Menu } from 'lucide-react';

interface TopNavbarProps {
  onOpenMobileMenu?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({ onOpenMobileMenu }) => {
  const pathname = usePathname();
  const { user, role } = useAuth();
  const [imgError, setImgError] = useState(false);

  const pathSegments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1));

  const roleVariant =
    role === 'super_admin'
      ? 'vip'
      : role === 'admin'
      ? 'crimson'
      : role === 'cinema_admin'
      ? 'imax'
      : 'slate';

  const avatarSrc = user?.avatarUrl ? resolveImageUrl(user.avatarUrl) : '';

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-[#080c14]/90 px-3 sm:px-6 backdrop-blur-md">
      {/* Breadcrumb & Brand Identifier */}
      <div className="flex items-center gap-2 text-xs overflow-hidden">
        {/* Hamburger Menu on Mobile */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          title="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100 shrink-0">
          <span className="h-2 w-2 rounded-full bg-red-600 dark:bg-red-500 animate-pulse shadow-sm shadow-red-500" />
          <span className="tracking-wide">Aflamak Cinemas</span>
        </div>
        {pathSegments.length > 0 && <span className="text-slate-400 hidden sm:inline">/</span>}
        <div className="hidden sm:flex items-center gap-1 truncate">
          {pathSegments.map((segment, idx) => (
            <React.Fragment key={idx}>
              <span
                className={
                  idx === pathSegments.length - 1
                    ? 'font-bold text-red-600 dark:text-red-400 truncate'
                    : 'text-slate-500 dark:text-slate-400'
                }
              >
                {segment}
              </span>
              {idx < pathSegments.length - 1 && <span className="text-slate-400">/</span>}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Live Booking Pulse */}
        <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          <span>Booking System Online</span>
        </div>

        {/* Role Badge */}
        {role && (
          <Badge variant={roleVariant as any} size="sm">
            {role.replace('_', ' ').toUpperCase()}
          </Badge>
        )}

        {/* Dark/Light Mode Toggle */}
        <ThemeToggle />

        {/* User Avatar & Profile Info */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          {avatarSrc && !imgError ? (
            <img
              src={avatarSrc}
              alt={user?.name || 'Admin'}
              onError={() => setImgError(true)}
              className="h-7 w-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shadow-sm"
              title={user?.email || 'Logged in user'}
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-red-600 to-rose-700 text-xs font-bold text-white shadow-sm shadow-red-600/30"
              title={user?.email || 'Logged in user'}
            >
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          )}
          {user?.name && (
            <span className="hidden md:inline text-xs font-semibold text-slate-700 dark:text-slate-300">
              {user.name}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;



