'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  collection, doc, updateDoc, DocumentSnapshot,
  query, orderBy, limit, where, getDocs, onSnapshot, startAfter,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { exportToCSV } from '@/lib/csv-export';

const PAGE_SIZE = 50;

interface AppUser {
  id: string;
  displayName: string;
  bio?: string;
  loyaltyTier: string;
  pointsBalance: number;
  reviewCount: number;
  followersCount: number;
  isBanned: boolean;
  isDeleted: boolean;
  onboardingComplete: boolean;
  createdAt?: { seconds: number };
}

interface DrawerReview {
  id: string;
  score?: number;
  text?: string;
  establishmentId?: string;
  createdAt?: { seconds: number };
}

interface LedgerEntry {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  reason?: string;
  createdAt?: { seconds: number };
}

type StatusFilter = 'all' | 'active' | 'banned';

function UserDrawer({
  user,
  onClose,
  onToggleBan,
  acting,
}: {
  user: AppUser;
  onClose: () => void;
  onToggleBan: (u: AppUser) => void;
  acting: string | null;
}) {
  const [reviews, setReviews] = useState<DrawerReview[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [loadingLedger, setLoadingLedger] = useState(true);

  useEffect(() => {
    setLoadingReviews(true);
    setLoadingLedger(true);

    getDocs(
      query(
        collection(db, 'reviews'),
        where('authorUid', '==', user.id),
        limit(5),
      )
    ).then((snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DrawerReview)));
    }).catch(() => {}).finally(() => setLoadingReviews(false));

    getDocs(
      query(
        collection(db, 'pointsLedger'),
        where('userId', '==', user.id),
        limit(10),
      )
    ).then((snap) => {
      setLedger(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
    }).catch(() => {}).finally(() => setLoadingLedger(false));
  }, [user.id]);

  const tierBadge: Record<string, string> = {
    bronze: 'bg-amber-100 text-amber-700',
    silver: 'bg-gray-100 text-gray-600',
    gold: 'bg-yellow-100 text-yellow-700',
    platinum: 'bg-blue-100 text-blue-700',
  };

  const handleExport = () => {
    exportToCSV(`user_${user.id.slice(0, 8)}`, [{
      displayName: user.displayName || '',
      uid: user.id,
      loyaltyTier: user.loyaltyTier || '',
      pointsBalance: user.pointsBalance ?? 0,
      reviewCount: user.reviewCount ?? 0,
      followersCount: user.followersCount ?? 0,
      isBanned: user.isBanned ? 'true' : 'false',
      isDeleted: user.isDeleted ? 'true' : 'false',
      onboardingComplete: user.onboardingComplete ? 'true' : 'false',
      createdAt: user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : '',
    }]);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 translate-x-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="text-base font-bold text-gray-900 truncate">{user.displayName || 'Unknown'}</h2>
            <p className="text-xs text-gray-400 font-mono mt-0.5 truncate">{user.id}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${tierBadge[user.loyaltyTier] ?? 'bg-gray-100 text-gray-500'}`}>
                {user.loyaltyTier || 'bronze'}
              </span>
              {user.isBanned ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Banned</span>
              ) : user.isDeleted ? (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Deleted</span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none shrink-0">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Points', value: (user.pointsBalance ?? 0).toLocaleString() },
              { label: 'Reviews', value: user.reviewCount ?? 0 },
              { label: 'Followers', value: user.followersCount ?? 0 },
            ].map((s) => (
              <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Bio */}
          {user.bio && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Bio</p>
              <p className="text-sm text-gray-700">{user.bio}</p>
            </div>
          )}

          {/* Onboarding */}
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Onboarding</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${user.onboardingComplete ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {user.onboardingComplete ? 'Complete' : 'Incomplete'}
            </span>
          </div>

          {/* Recent reviews */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Reviews</p>
            {loadingReviews ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No reviews yet.</p>
            ) : (
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-900">Score: {r.score ?? '—'}</span>
                      <span className="text-xs text-gray-400">
                        {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                      </span>
                    </div>
                    {r.establishmentId && (
                      <p className="text-xs text-gray-400 font-mono truncate mb-1">{r.establishmentId}</p>
                    )}
                    {r.text && (
                      <p className="text-xs text-gray-600 line-clamp-2">{r.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points ledger */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Points Ledger</p>
            {loadingLedger ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : ledger.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">No ledger entries.</p>
            ) : (
              <div className="space-y-1.5">
                {ledger.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`font-bold shrink-0 ${l.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                        {l.type === 'credit' ? '+' : '-'}{l.amount}
                      </span>
                      <span className="text-gray-500 truncate">{l.reason || '—'}</span>
                    </div>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {l.createdAt ? new Date(l.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center gap-3 shrink-0">
          <button
            onClick={() => onToggleBan(user)}
            disabled={acting === user.id || user.isDeleted}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors disabled:opacity-40 ${
              user.isBanned
                ? 'bg-green-500 hover:bg-green-600 text-white border-green-500'
                : 'bg-red-500 hover:bg-red-600 text-white border-red-500'
            }`}
          >
            {acting === user.id ? '…' : user.isBanned ? 'Unban User' : 'Ban User'}
          </button>
          <button
            onClick={handleExport}
            className="px-3 py-2 border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 text-sm font-medium rounded-lg transition-colors"
          >
            Export
          </button>
        </div>
      </div>
    </>
  );
}

export default function UsersPage() {
  const [items, setItems] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Initial real-time load of first page
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
      setItems(docs);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
      setLoading(false);
      // Keep selectedUser in sync if it's been updated
      setSelectedUser((prev) => {
        if (!prev) return null;
        const updated = docs.find((u) => u.id === prev.id);
        return updated ?? prev;
      });
    }, () => setLoading(false));
    return unsub;
  }, []);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE),
      );
      const snap = await getDocs(q);
      const newDocs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser));
      setItems((prev) => {
        const existingIds = new Set(prev.map((u) => u.id));
        const merged = [...prev, ...newDocs.filter((u) => !existingIds.has(u.id))];
        return merged;
      });
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally { setLoadingMore(false); }
  };

  const filtered = useMemo(() => {
    let result = items;
    if (statusFilter === 'banned') result = result.filter((u) => u.isBanned);
    if (statusFilter === 'active') result = result.filter((u) => !u.isBanned && !u.isDeleted);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) => u.displayName?.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [items, search, statusFilter]);

  const toggleBan = async (user: AppUser) => {
    const action = user.isBanned ? 'unban' : 'ban';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} ${user.displayName}?`)) return;
    setActing(user.id);
    try {
      await updateDoc(doc(db, 'users', user.id), { isBanned: !user.isBanned });
      showToast(`${user.displayName} ${user.isBanned ? 'unbanned' : 'banned'} ✓`);
    } finally { setActing(null); }
  };

  const tierBadge: Record<string, string> = {
    bronze: 'bg-amber-100 text-amber-700',
    silver: 'bg-gray-100 text-gray-600',
    gold: 'bg-yellow-100 text-yellow-700',
    platinum: 'bg-blue-100 text-blue-700',
  };

  const counts = {
    all: items.length,
    active: items.filter((u) => !u.isBanned && !u.isDeleted).length,
    banned: items.filter((u) => u.isBanned).length,
  };

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* User detail drawer */}
      {selectedUser && (
        <UserDrawer
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onToggleBan={toggleBan}
          acting={acting}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">
            Showing {items.length} users · {counts.banned} banned · live updates
          </p>
        </div>
        <button
          onClick={() => exportToCSV('users', filtered.map((u) => ({
            displayName: u.displayName || '',
            loyaltyTier: u.loyaltyTier || '',
            pointsBalance: u.pointsBalance ?? 0,
            reviewCount: u.reviewCount ?? 0,
            isBanned: u.isBanned ? 'true' : 'false',
            createdAt: u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : '',
          })))}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 text-sm font-medium rounded-lg transition-colors"
        >
          <span>&#8595;</span> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or UID…"
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'active', 'banned'] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === f
                  ? f === 'banned' ? 'bg-red-500 text-white border-red-500' : 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
              <span className="ml-1.5 text-xs opacity-70">({counts[f]})</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No users found.</div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tier</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reviews</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={`hover:bg-orange-50/40 transition-colors cursor-pointer ${u.isBanned ? 'opacity-60' : ''}`}
                  >
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{u.displayName || 'Unknown'}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{u.id.slice(0, 14)}…</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${tierBadge[u.loyaltyTier] ?? 'bg-gray-100 text-gray-500'}`}>
                        {u.loyaltyTier || 'bronze'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-gray-900">
                      {(u.pointsBalance ?? 0).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{u.reviewCount ?? 0}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {u.createdAt ? new Date(u.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {u.isBanned ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">Banned</span>
                      ) : u.isDeleted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Deleted</span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end">
                        <button
                          onClick={(ev) => { ev.stopPropagation(); toggleBan(u); }}
                          disabled={acting === u.id || u.isDeleted}
                          className={`text-xs font-semibold disabled:opacity-40 transition-colors ${
                            u.isBanned ? 'text-green-600 hover:text-green-800' : 'text-red-400 hover:text-red-600'
                          }`}
                        >
                          {acting === u.id ? '…' : u.isBanned ? 'Unban' : 'Ban'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">Showing {items.length} users</p>
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-4 py-2 bg-white border border-gray-200 hover:border-gray-300 text-sm font-medium text-gray-600 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </>
                  ) : 'Load more'}
                </button>
              </div>
            )}
            {!hasMore && items.length >= PAGE_SIZE && (
              <div className="px-5 py-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">Showing all {items.length} users</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
