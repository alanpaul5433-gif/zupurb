'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, updateDoc,
  query, orderBy, onSnapshot, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { exportToCSV } from '@/lib/csv-export';

interface Rev {
  id: string;
  authorName: string;
  authorUid: string;
  estId: string;
  text?: string;
  score?: number;
  status: string;
  verificationTier?: string;
  createdAt?: { seconds: number };
}

type Filter = 'all' | 'pending' | 'published' | 'removed';

export default function ReviewsPage() {
  const [items, setItems] = useState<Rev[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Rev)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const pending = items.filter((r) => r.status === 'pending');

  const filtered = items.filter((r) => {
    if (filter === 'all') return true;
    return r.status === filter;
  });

  const setStatus = async (id: string, status: string) => {
    setActing(id);
    try {
      await updateDoc(doc(db, 'reviews', id), { status });
      showToast(`Review ${status} ✓`);
    } finally { setActing(null); }
  };

  const publishAll = async () => {
    if (pending.length === 0) return;
    if (!confirm(`Publish all ${pending.length} pending reviews?`)) return;
    setBulkLoading(true);
    try {
      const batch = writeBatch(db);
      pending.forEach((r) => batch.update(doc(db, 'reviews', r.id), { status: 'published' }));
      await batch.commit();
      showToast(`${pending.length} reviews published ✓`);
    } finally { setBulkLoading(false); }
  };

  const filterCounts: Record<Filter, number> = {
    all: items.length,
    pending: items.filter(r => r.status === 'pending').length,
    published: items.filter(r => r.status === 'published').length,
    removed: items.filter(r => r.status === 'removed').length,
  };

  const scoreColor = (s?: number) => {
    if (!s) return 'text-gray-400';
    if (s >= 8) return 'text-green-600';
    if (s >= 6) return 'text-yellow-600';
    return 'text-red-500';
  };

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} total · {filterCounts.pending} pending · live updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToCSV('reviews', filtered.map((r) => ({
              authorName: r.authorName || '',
              estId: r.estId || '',
              score: r.score != null ? r.score : '',
              status: r.status,
              verificationTier: r.verificationTier || '',
              createdAt: r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '',
            })))}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 text-sm font-medium rounded-lg transition-colors"
          >
            <span>&#8595;</span> Export CSV
          </button>
          {pending.length > 0 && (
            <button
              onClick={publishAll}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {bulkLoading ? '…' : `✓ Publish All (${pending.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'published', 'removed'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 opacity-60 text-xs">({filterCounts[f]})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No reviews found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Author</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-72">Review</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{r.authorName || 'Anonymous'}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{r.authorUid?.slice(0, 8)}…</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">{r.estId || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600 max-w-xs">
                    {r.text
                      ? <p className="line-clamp-2 leading-relaxed">{r.text}</p>
                      : <span className="text-gray-300 italic text-xs">No written text</span>
                    }
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`font-bold text-base ${scoreColor(r.score)}`}>
                      {r.score != null ? r.score.toFixed(1) : '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      r.status === 'published' ? 'bg-green-100 text-green-700'
                        : r.status === 'removed' ? 'bg-red-100 text-red-600'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {r.status !== 'published' && (
                        <button onClick={() => setStatus(r.id, 'published')} disabled={acting === r.id}
                          className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50">
                          Publish
                        </button>
                      )}
                      {r.status !== 'removed' && (
                        <button onClick={() => setStatus(r.id, 'removed')} disabled={acting === r.id}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50">
                          Remove
                        </button>
                      )}
                      {r.status === 'removed' && (
                        <button onClick={() => setStatus(r.id, 'pending')} disabled={acting === r.id}
                          className="text-xs font-semibold text-gray-500 hover:text-gray-700 disabled:opacity-50">
                          Restore
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
