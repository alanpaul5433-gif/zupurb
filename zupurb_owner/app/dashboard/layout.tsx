'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useOwnerAuth } from '@/lib/owner-auth-context';

const MOBILE_QUERY = '(max-width: 1023px)';

// External-store reads for the viewport size so the initial value is available
// at first render (SSR-safe) without a synchronous setState inside an effect.
function subscribeViewport(onChange: () => void): () => void {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
const isMobileSnapshot = () => window.matchMedia(MOBILE_QUERY).matches;
const isMobileServerSnapshot = () => false;

const NAV = [
  { href: '/dashboard', label: 'Overview', icon: '◼' },
  { href: '/dashboard/establishment', label: 'My Establishment', icon: '🏪' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: '⭐' },
  { href: '/dashboard/deals', label: 'Deals', icon: '🏷️' },
  { href: '/dashboard/reservations', label: 'Reservations', icon: '📅' },
  { href: '/dashboard/reservations/slots', label: 'Slot Manager', icon: '🗓️' },
  { href: '/dashboard/checkin', label: 'Check-In', icon: '🔲' },
  { href: '/dashboard/announcements', label: 'Announcements', icon: '📢' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isOwner, loading, logout, displayName } = useOwnerAuth();
  const router = useRouter();
  const pathname = usePathname();
  // Viewport tracked via an external store (SSR-safe, no setState-in-effect).
  const isMobile = useSyncExternalStore(
    subscribeViewport,
    isMobileSnapshot,
    isMobileServerSnapshot,
  );
  // `collapsed` defaults to the viewport state; an explicit user toggle overrides it.
  const [manualCollapsed, setManualCollapsed] = useState<boolean | null>(null);
  const collapsed = manualCollapsed ?? isMobile;
  const setCollapsed = setManualCollapsed;

  useEffect(() => {
    if (!loading && (!user || !isOwner)) {
      router.replace('/login');
    }
  }, [user, isOwner, loading, router]);

  if (loading || !user || !isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-20 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      <aside
        className={`bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-200 z-30 ${
          collapsed ? 'w-14' : 'w-60'
        } fixed lg:relative h-full`}
      >
        {/* Logo + toggle */}
        <div className={`border-b border-gray-100 flex items-center ${collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5 justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#BF5B2E' }}>
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Zupurb</p>
                <p className="text-xs text-gray-400">Owner Portal</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#BF5B2E' }}>
              <span className="text-white font-bold text-sm">Z</span>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="text-gray-400 hover:text-gray-700 transition-colors text-sm leading-none ml-2"
              aria-label="Collapse sidebar"
            >
              ←
            </button>
          )}
        </div>

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={() => setCollapsed(false)}
              className="text-gray-400 hover:text-gray-700 transition-colors text-sm leading-none"
              aria-label="Expand sidebar"
            >
              ►
            </button>
          </div>
        )}

        {/* Owner identity */}
        {!collapsed && (
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold mt-0.5" style={{ backgroundColor: '#BF5B2E22', color: '#BF5B2E' }}>
              Owner
            </span>
          </div>
        )}

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
                style={active ? { backgroundColor: '#BF5B2E' } : {}}
              >
                <span className="text-base leading-none shrink-0">{item.icon}</span>
                {!collapsed && <span className="flex-1">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`py-4 border-t border-gray-100 ${collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-4'}`}>
          {!collapsed && (
            <p className="text-xs text-gray-500 truncate mb-2">{user.email}</p>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? 'Sign out' : undefined}
            className={`text-xs text-red-500 hover:text-red-700 font-medium transition-colors ${collapsed ? 'text-base' : ''}`}
          >
            {collapsed ? '⏻' : 'Sign out'}
          </button>
        </div>
      </aside>

      {/* Mobile hamburger */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed top-4 left-4 z-40 lg:hidden w-9 h-9 bg-white border border-gray-200 rounded-lg flex items-center justify-center shadow-sm"
          aria-label="Open menu"
        >
          <span className="text-gray-600 text-lg leading-none">☰</span>
        </button>
      )}

      <main className="flex-1 overflow-auto lg:ml-0 ml-0">
        {children}
      </main>
    </div>
  );
}
