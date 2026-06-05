'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/lib/auth-context';
import { db } from '@/lib/firebase';

type BadgeKey = 'establishments' | 'reviews' | 'claims' | null;

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

const NAV: { href: string; label: string; icon: string; section: string | null; badge: BadgeKey }[] = [
  { href: '/dashboard', label: 'Overview', icon: '◼', section: null, badge: null },
  { href: '/dashboard/establishments', label: 'Establishments', icon: '🏢', section: 'Content', badge: 'establishments' },
  { href: '/dashboard/reviews', label: 'Reviews', icon: '⭐', section: 'Content', badge: 'reviews' },
  { href: '/dashboard/claims', label: 'Claim Requests', icon: '📋', section: 'Content', badge: 'claims' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: '📊', section: 'Content', badge: null },
  { href: '/dashboard/reservations', label: 'Reservations', icon: '📅', section: 'Content', badge: null },
  { href: '/dashboard/moderation', label: 'Moderation', icon: '🚩', section: 'Content', badge: null },
  { href: '/dashboard/deals', label: 'Deals', icon: '🏷️', section: 'Content', badge: null },
  { href: '/dashboard/users', label: 'Users', icon: '👤', section: 'Users', badge: null },
  { href: '/dashboard/points', label: 'Points', icon: '🪙', section: 'Users', badge: null },
  { href: '/dashboard/notifications', label: 'Notifications', icon: '🔔', section: 'Tools', badge: null },
  { href: '/dashboard/seed', label: 'Seed Data', icon: '🌱', section: 'Tools', badge: null },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingEstablishments, setPendingEstablishments] = useState(0);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
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
  // Dark mode initialised lazily from localStorage; the DOM class is synced via effect.
  const [darkMode, setDarkMode] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem('zupurb-dark') === 'true',
  );

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const toggleDark = () => {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem('zupurb-dark', String(next));
  };

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.replace('/login');
    }
  }, [user, isAdmin, loading, router]);

  // Live pending counts
  useEffect(() => {
    if (!user || !isAdmin) return;

    const estQ = query(collection(db, 'establishments'), where('isActive', '==', false));
    const unsubEst = onSnapshot(estQ, (snap) => {
      setPendingEstablishments(snap.size);
    }, () => {});

    const revQ = query(collection(db, 'reviews'), where('status', '==', 'pending'));
    const unsubRev = onSnapshot(revQ, (snap) => {
      setPendingReviews(snap.size);
    }, () => {});

    const claimQ = query(collection(db, 'claimRequests'), where('status', '==', 'pending'));
    const unsubClaim = onSnapshot(claimQ, (snap) => {
      setPendingClaims(snap.size);
    }, () => {});

    return () => { unsubEst(); unsubRev(); unsubClaim(); };
  }, [user, isAdmin]);

  if (loading || !user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  const getBadgeCount = (badge: BadgeKey) => {
    if (badge === 'establishments') return pendingEstablishments;
    if (badge === 'reviews') return pendingReviews;
    if (badge === 'claims') return pendingClaims;
    return 0;
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      <aside
        className={`bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col shrink-0 transition-all duration-200 ${
          collapsed ? 'w-14' : 'w-60'
        }`}
      >
        {/* Logo + toggle */}
        <div className={`border-b border-gray-100 dark:border-gray-800 flex items-center ${collapsed ? 'px-3 py-5 justify-center' : 'px-5 py-5 justify-between'}`}>
          {!collapsed && (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">Z</span>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900 dark:text-white">Zupurb</p>
                <p className="text-xs text-gray-400 dark:text-gray-400">Admin Panel</p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">Z</span>
            </div>
          )}
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={`text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors text-sm leading-none ${collapsed ? 'hidden' : 'ml-2'}`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            ←
          </button>
        </div>

        {/* Toggle button when collapsed */}
        {collapsed && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={() => setCollapsed(false)}
              className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors text-sm leading-none"
              aria-label="Expand sidebar"
            >
              ►
            </button>
          </div>
        )}

        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {(() => {
            const sections: string[] = [];
            return NAV.map((item) => {
              const active = pathname === item.href;
              const showSection = item.section && !sections.includes(item.section);
              if (item.section && showSection) sections.push(item.section);
              const badgeCount = getBadgeCount(item.badge);
              return (
                <div key={item.href}>
                  {showSection && !collapsed && (
                    <p className="px-3 pt-4 pb-1 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                      {item.section}
                    </p>
                  )}
                  {showSection && collapsed && <div className="pt-3" />}
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`relative flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                      collapsed ? 'justify-center' : ''
                    } ${
                      active
                        ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <span className="text-base leading-none shrink-0">{item.icon}</span>
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && badgeCount > 0 && (
                      <span className="ml-auto text-xs bg-orange-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-tight">
                        {badgeCount}
                      </span>
                    )}
                    {collapsed && badgeCount > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-orange-500 rounded-full" />
                    )}
                  </Link>
                </div>
              );
            });
          })()}
        </nav>

        <div className={`py-4 border-t border-gray-100 dark:border-gray-800 ${collapsed ? 'px-2 flex flex-col items-center gap-2' : 'px-4'}`}>
          {!collapsed && (
            <p className="text-xs text-gray-500 dark:text-gray-500 truncate mb-2">{user.email}</p>
          )}
          <div className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'gap-3'}`}>
            <button
              onClick={toggleDark}
              title={collapsed ? (darkMode ? 'Light mode' : 'Dark mode') : undefined}
              className={`flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white font-medium transition-colors ${collapsed ? 'text-base' : ''}`}
            >
              <span>{darkMode ? '☀️' : '🌙'}</span>
              {!collapsed && <span>{darkMode ? 'Light' : 'Dark'}</span>}
            </button>
            <button
              onClick={handleLogout}
              title={collapsed ? 'Sign out' : undefined}
              className={`text-xs text-red-500 hover:text-red-700 font-medium transition-colors ${collapsed ? 'text-base' : ''}`}
            >
              {collapsed ? '⏻' : 'Sign out'}
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto dark:bg-gray-950">
        {children}
      </main>
    </div>
  );
}
