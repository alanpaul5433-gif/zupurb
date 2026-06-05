'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, updateDoc,
  query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Flag {
  id: string;
  reportedBy: string;
  targetType: 'review' | 'establishment' | 'user';
  targetId: string;
  reason: string;
  status: 'open' | 'resolved' | 'escalated';
  createdAt?: { seconds: number };
}

type Filter = 'all' | 'open' | 'resolved' | 'escalated';

export default function ModerationPage() {
  const [items, setItems] = useState<Flag[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'flags'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Flag)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const act = async (id: string, status: string, extra?: Record<string, unknown>) => {
    setActing(id);
    try {
      await updateDoc(doc(db, 'flags', id), { status, ...extra });
      showToast(`Flag ${status} ✓`);
    } finally { setActing(null); }
  };

  const filtered = items.filter((f) => filter === 'all' || f.status === filter);

  const counts: Record<Filter, number> = {
    all: items.length,
    open: items.filter(f => f.status === 'open').length,
    resolved: items.filter(f => f.status === 'resolved').length,
    escalated: items.filter(f => f.status === 'escalated').length,
  };

  const statusBadge: Record<string, string> = {
    open: 'bg-red-100 text-red-600',
    resolved: 'bg-green-100 text-green-700',
    escalated: 'bg-amber-100 text-amber-700',
  };

  const typeBadge: Record<string, string> = {
    review: 'bg-blue-100 text-blue-700',
    establishment: 'bg-purple-100 text-purple-700',
    user: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Moderation</h1>
        <p className="text-sm text-gray-500 mt-1">{items.length} total flags · live updates</p>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'open', 'resolved', 'escalated'] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 opacity-60 text-xs">({counts[f]})</span>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No flagged content.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Target ID</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reported By</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeBadge[f.targetType] ?? 'bg-gray-100 text-gray-500'}`}>
                      {f.targetType}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{f.targetId?.slice(0, 12)}…</td>
                  <td className="px-5 py-3.5 text-gray-700 max-w-xs">
                    <p className="line-clamp-2">{f.reason || '—'}</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{f.reportedBy?.slice(0, 10)}…</td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {f.createdAt ? new Date(f.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[f.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {f.status === 'open' && (
                        <>
                          <button
                            onClick={() => act(f.id, 'resolved')}
                            disabled={acting === f.id}
                            className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            Resolve
                          </button>
                          <button
                            onClick={() => act(f.id, 'escalated')}
                            disabled={acting === f.id}
                            className="text-xs font-semibold text-amber-600 hover:text-amber-800 disabled:opacity-50"
                          >
                            Escalate
                          </button>
                          <button
                            onClick={() => act(f.id, 'resolved', { note: 'dismissed' })}
                            disabled={acting === f.id}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-600 disabled:opacity-50"
                          >
                            Dismiss
                          </button>
                        </>
                      )}
                      {f.status === 'escalated' && (
                        <button
                          onClick={() => act(f.id, 'resolved')}
                          disabled={acting === f.id}
                          className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          Resolve
                        </button>
                      )}
                      {f.status === 'resolved' && (
                        <span className="text-xs text-gray-300">Done</span>
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
