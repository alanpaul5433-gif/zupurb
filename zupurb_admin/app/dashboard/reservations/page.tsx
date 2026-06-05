'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, updateDoc,
  query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Reservation {
  id: string;
  guestName: string;
  guestUid: string;
  estId: string;
  estName: string;
  date?: { seconds: number };
  partySize: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  createdAt?: { seconds: number };
}

type Filter = 'all' | 'pending' | 'confirmed' | 'cancelled';

export default function ReservationsPage() {
  const [items, setItems] = useState<Reservation[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'reservations'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const setStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    setActing(id);
    try {
      await updateDoc(doc(db, 'reservations', id), { status });
      showToast(`Reservation ${status} ✓`);
    } finally { setActing(null); }
  };

  const filtered = items.filter((r) => filter === 'all' || r.status === filter);

  const counts: Record<Filter, number> = {
    all: items.length,
    pending: items.filter(r => r.status === 'pending').length,
    confirmed: items.filter(r => r.status === 'confirmed').length,
    cancelled: items.filter(r => r.status === 'cancelled').length,
  };

  const statusBadge: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
        <p className="text-sm text-gray-500 mt-1">{items.length} total · live updates</p>
      </div>

      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'confirmed', 'cancelled'] as Filter[]).map((f) => (
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
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No reservations yet.</p>
            <p className="text-gray-300 text-xs mt-2">Reservations appear here when guests book through the app.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Guest</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date &amp; Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Party</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{r.guestName || 'Unknown'}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{r.guestUid?.slice(0, 10)}…</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{r.estName || r.estId || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">
                    {r.date ? new Date(r.date.seconds * 1000).toLocaleString() : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-700 font-medium">{r.partySize ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === 'pending' && (
                        <>
                          <button
                            onClick={() => setStatus(r.id, 'confirmed')}
                            disabled={acting === r.id}
                            className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setStatus(r.id, 'cancelled')}
                            disabled={acting === r.id}
                            className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {r.status === 'confirmed' && (
                        <button
                          onClick={() => setStatus(r.id, 'cancelled')}
                          disabled={acting === r.id}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      {r.status === 'cancelled' && (
                        <span className="text-xs text-gray-300">—</span>
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
