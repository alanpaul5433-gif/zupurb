'use client';

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, Timestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';

interface ClaimRequest {
  id: string;
  estId: string;
  estName: string;
  uid: string;
  displayName: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
}

type TabFilter = 'pending' | 'approved' | 'rejected';

export default function ClaimsPage() {
  const [items, setItems] = useState<ClaimRequest[]>([]);
  const [tab, setTab] = useState<TabFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Real-time listener on claimRequests, ordered by createdAt desc
  useEffect(() => {
    const q = query(collection(db, 'claimRequests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ClaimRequest)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, []);

  const filtered = items.filter((c) => c.status === tab);

  const tabCounts: Record<TabFilter, number> = {
    pending: items.filter((c) => c.status === 'pending').length,
    approved: items.filter((c) => c.status === 'approved').length,
    rejected: items.filter((c) => c.status === 'rejected').length,
  };

  const handleApprove = async (id: string) => {
    setActing(id);
    try {
      const functions = getFunctions(app);
      const approveClaimRequest = httpsCallable(functions, 'approveClaimRequest');
      await approveClaimRequest({ claimRequestId: id });
      showToast('Claim approved ✓');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Error: ${msg}`);
    } finally {
      setActing(null);
    }
  };

  const handleReject = async (id: string) => {
    setActing(id);
    try {
      const functions = getFunctions(app);
      const rejectClaimRequest = httpsCallable(functions, 'rejectClaimRequest');
      await rejectClaimRequest({ claimRequestId: id });
      showToast('Claim rejected');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Error: ${msg}`);
    } finally {
      setActing(null);
    }
  };

  const formatDate = (ts?: Timestamp) => {
    if (!ts) return '—';
    return new Date(ts.seconds * 1000).toLocaleDateString();
  };

  const statusBadge = (status: ClaimRequest['status']) => {
    if (status === 'approved') return 'bg-green-100 text-green-700';
    if (status === 'rejected') return 'bg-red-100 text-red-600';
    return 'bg-yellow-100 text-yellow-700';
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Claim Requests</h1>
        <p className="text-sm text-gray-500 mt-1">
          {items.length} total · {tabCounts.pending} pending · live updates
        </p>
      </div>

      {/* Tab filters */}
      <div className="flex gap-2 mb-5">
        {(['pending', 'approved', 'rejected'] as TabFilter[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t
                ? 'bg-orange-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="ml-1.5 opacity-60 text-xs">({tabCounts[t]})</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No {tab} claims.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Business Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Claimant Name
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Email
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Submitted
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Status
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{c.estName || '—'}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{c.estId?.slice(0, 10)}…</p>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{c.displayName || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-600">{c.email || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{formatDate(c.createdAt)}</td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(c.status)}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {c.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(c.id)}
                            disabled={acting === c.id}
                            className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(c.id)}
                            disabled={acting === c.id}
                            className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </>
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
