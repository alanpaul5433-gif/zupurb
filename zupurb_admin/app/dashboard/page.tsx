'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface RecentReview {
  id: string;
  authorUid?: string;
  authorName?: string;
  establishmentId?: string;
  score?: number;
  text?: string;
  createdAt?: { seconds: number };
}

interface RecentEst {
  id: string;
  name: string;
  type?: string;
  area?: string;
  isActive: boolean;
  createdAt?: { seconds: number };
}

interface Stats {
  totalUsers: number;
  totalEstablishments: number;
  pendingEstablishments: number;
  totalReviews: number;
  pendingReviews: number;
  bannedUsers: number;
  activeDeals: number;
  totalPointsIssued: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalEstablishments: 0,
    pendingEstablishments: 0,
    totalReviews: 0,
    pendingReviews: 0,
    bannedUsers: 0,
    activeDeals: 0,
    totalPointsIssued: 0,
  });
  const [loading, setLoading] = useState(true);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [recentEsts, setRecentEsts] = useState<RecentEst[]>([]);

  useEffect(() => {
    const unsubs: (() => void)[] = [];

    // Users
    unsubs.push(onSnapshot(query(collection(db, 'users'), limit(500)), (snap) => {
      const docs = snap.docs.map((d) => d.data());
      setStats((prev) => ({
        ...prev,
        totalUsers: snap.size,
        bannedUsers: docs.filter((u) => u['isBanned']).length,
        totalPointsIssued: docs.reduce((sum, u) => sum + (u['pointsBalance'] ?? 0), 0),
      }));
      setLoading(false);
    }, () => setLoading(false)));

    // Establishments
    unsubs.push(onSnapshot(query(collection(db, 'establishments'), limit(500)), (snap) => {
      const docs = snap.docs.map((d) => d.data());
      setStats((prev) => ({
        ...prev,
        totalEstablishments: snap.size,
        pendingEstablishments: docs.filter((e) => !e['isActive']).length,
      }));
    }, () => {}));

    // Reviews
    unsubs.push(onSnapshot(query(collection(db, 'reviews'), limit(500)), (snap) => {
      const docs = snap.docs.map((d) => d.data());
      setStats((prev) => ({
        ...prev,
        totalReviews: snap.size,
        pendingReviews: docs.filter((r) => r['status'] === 'pending').length,
      }));
    }, () => {}));

    // Active deals
    unsubs.push(onSnapshot(
      query(collection(db, 'deals'), where('isActive', '==', true), limit(500)),
      (snap) => {
        setStats((prev) => ({ ...prev, activeDeals: snap.size }));
      }, () => {}
    ));

    // Recent reviews
    unsubs.push(onSnapshot(
      query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        setRecentReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecentReview)));
      }, () => {}
    ));

    // Recent establishments
    unsubs.push(onSnapshot(
      query(collection(db, 'establishments'), orderBy('createdAt', 'desc'), limit(5)),
      (snap) => {
        setRecentEsts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as RecentEst)));
      }, () => {}
    ));

    return () => unsubs.forEach((u) => u());
  }, []);

  const statCards = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      color: 'bg-blue-50',
      valueColor: 'text-blue-700',
      badge: stats.bannedUsers > 0 ? `${stats.bannedUsers} banned` : undefined,
      badgeColor: 'bg-red-100 text-red-600',
    },
    {
      label: 'Establishments',
      value: stats.totalEstablishments,
      color: 'bg-green-50',
      valueColor: 'text-green-700',
      badge: stats.pendingEstablishments > 0 ? `${stats.pendingEstablishments} pending` : undefined,
      badgeColor: 'bg-yellow-100 text-yellow-700',
    },
    {
      label: 'Reviews',
      value: stats.totalReviews,
      color: 'bg-purple-50',
      valueColor: 'text-purple-700',
      badge: stats.pendingReviews > 0 ? `${stats.pendingReviews} pending` : undefined,
      badgeColor: 'bg-yellow-100 text-yellow-700',
    },
    {
      label: 'Active Deals',
      value: stats.activeDeals,
      color: 'bg-orange-50',
      valueColor: 'text-orange-700',
      badge: undefined,
      badgeColor: '',
    },
    {
      label: 'Total Points Issued',
      value: stats.totalPointsIssued.toLocaleString(),
      color: 'bg-amber-50',
      valueColor: 'text-amber-700',
      badge: undefined,
      badgeColor: '',
    },
  ];

  const quickActions = [
    { href: '/dashboard/establishments', label: 'Review pending establishments', color: 'bg-yellow-50 border-yellow-200 text-yellow-800' },
    { href: '/dashboard/reviews', label: 'Moderate pending reviews', color: 'bg-purple-50 border-purple-200 text-purple-800' },
    { href: '/dashboard/users', label: 'Manage users', color: 'bg-blue-50 border-blue-200 text-blue-800' },
    { href: '/dashboard/points', label: 'Adjust points', color: 'bg-orange-50 border-orange-200 text-orange-800' },
    { href: '/dashboard/analytics', label: 'View analytics', color: 'bg-indigo-50 border-indigo-200 text-indigo-800' },
    { href: '/dashboard/reservations', label: 'Reservations', color: 'bg-teal-50 border-teal-200 text-teal-800' },
    { href: '/dashboard/moderation', label: 'Moderation queue', color: 'bg-red-50 border-red-200 text-red-800' },
    { href: '/dashboard/notifications', label: 'Send notifications', color: 'bg-green-50 border-green-200 text-green-800' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Zupurb platform at a glance · live updates</p>
      </div>

      {/* Stat cards */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((c) => (
            <div key={c.label} className={`rounded-xl border border-gray-200 p-6 ${c.color}`}>
              <p className="text-sm text-gray-500">{c.label}</p>
              <p className={`text-3xl font-bold mt-1 ${c.valueColor}`}>
                {typeof c.value === 'number' ? c.value.toLocaleString() : c.value}
              </p>
              {c.badge && (
                <span className={`inline-block mt-2 text-xs font-semibold px-2 py-0.5 rounded-full ${c.badgeColor}`}>
                  {c.badge}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {quickActions.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-opacity hover:opacity-80 ${item.color}`}
            >
              {item.label} →
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Reviews */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Reviews</h2>
          {recentReviews.length === 0 ? (
            <p className="text-sm text-gray-400">No reviews yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.map((r) => (
                <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    (r.score ?? 0) >= 8 ? 'bg-green-100 text-green-700'
                    : (r.score ?? 0) >= 6 ? 'bg-amber-100 text-amber-700'
                    : 'bg-red-100 text-red-600'
                  }`}>
                    {r.score ?? '—'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-700 truncate">
                      {r.authorName || r.authorUid?.slice(0, 12) || 'Unknown author'}
                    </p>
                    {r.establishmentId && (
                      <p className="text-xs text-gray-400 font-mono truncate">{r.establishmentId.slice(0, 16)}…</p>
                    )}
                    {r.text && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{r.text}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Establishments */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Recent Establishments</h2>
          {recentEsts.length === 0 ? (
            <p className="text-sm text-gray-400">No establishments yet.</p>
          ) : (
            <div className="space-y-3">
              {recentEsts.map((e) => (
                <div key={e.id} className="flex items-start justify-between gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{e.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{e.type || '—'} · {e.area || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      e.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {e.isActive ? 'Active' : 'Pending'}
                    </span>
                    <span className="text-xs text-gray-400">
                      {e.createdAt ? new Date(e.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
