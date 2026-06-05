'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, writeBatch, getDocs, limit,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';
import { exportToCSV } from '@/lib/csv-export';

interface Est {
  id: string;
  name: string;
  type: string;
  area: string;
  priceRange: string;
  isActive: boolean;
  status?: string;
  submittedBy?: string;
  imageUrl?: string;
  score?: number;
  tags?: string[];
  distanceKm?: number;
  openUntil?: string;
  hasAlcohol?: boolean;
  hasReservations?: boolean;
  hasDeals?: boolean;
  createdAt?: { seconds: number };
}

interface DrawerReview {
  id: string;
  authorUid?: string;
  authorName?: string;
  score?: number;
  text?: string;
  createdAt?: { seconds: number };
}

type Filter = 'all' | 'pending' | 'active';

// ─── Establishment Drawer ───────────────────────────────────────────────────

function EstDrawer({
  est,
  onClose,
  onApprove,
  onEdit,
  onDelete,
  acting,
  showToast,
}: {
  est: Est;
  onClose: () => void;
  onApprove: (id: string) => void;
  onEdit: (e: Est) => void;
  onDelete: (id: string, name: string) => void;
  acting: string | null;
  showToast: (msg: string) => void;
}) {
  const [reviews, setReviews] = useState<DrawerReview[]>([]);
  // Loading is derived from whether reviews have resolved for the current est.
  const [reviewsForId, setReviewsForId] = useState<string | null>(null);
  const loadingReviews = reviewsForId !== est.id;
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteDisplayName, setInviteDisplayName] = useState('');
  const [inviting, setInviting] = useState(false);

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const functions = getFunctions(app);
      const inviteOwner = httpsCallable(functions, 'inviteOwner');
      await inviteOwner({ email: inviteEmail.trim(), estId: est.id, displayName: inviteDisplayName.trim() || undefined });
      showToast(`Invite sent to ${inviteEmail.trim()} ✓`);
      setInviteEmail('');
      setInviteDisplayName('');
      setShowInvite(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Error: ${msg}`);
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    getDocs(
      query(
        collection(db, 'establishments', est.id, 'reviews'),
        limit(5),
      )
    ).then((snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as DrawerReview)));
    }).catch(() => {}).finally(() => setReviewsForId(est.id));
  }, [est.id]);

  const scoreColor = (s?: number) => {
    if (!s) return 'text-gray-400';
    if (s >= 8) return 'text-green-600';
    if (s >= 6) return 'text-amber-500';
    return 'text-red-500';
  };

  const scoreBg = (s?: number) => {
    if (!s) return 'bg-gray-100';
    if (s >= 8) return 'bg-green-50 border-green-200';
    if (s >= 6) return 'bg-amber-50 border-amber-200';
    return 'bg-red-50 border-red-200';
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-white shadow-xl z-50 flex flex-col transition-transform duration-200 translate-x-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div className="flex-1 min-w-0 mr-3">
            <h2 className="text-base font-bold text-gray-900 truncate">{est.name}</h2>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {est.type && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{est.type}</span>
              )}
              {est.area && (
                <span className="text-xs text-gray-500">{est.area}</span>
              )}
              {est.priceRange && (
                <span className="text-xs text-gray-500">{est.priceRange}</span>
              )}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                est.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
              }`}>
                {est.isActive ? '● Active' : '○ Pending'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-lg leading-none shrink-0">✕</button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Image */}
          {est.imageUrl ? (
            <img
              src={est.imageUrl}
              alt={est.name}
              className="w-full h-40 object-cover rounded-xl border border-gray-200"
            />
          ) : (
            <div className="w-full h-40 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center">
              <span className="text-gray-300 text-4xl">🏢</span>
            </div>
          )}

          {/* Score */}
          {est.score !== undefined && (
            <div className={`border rounded-xl p-4 flex items-center gap-4 ${scoreBg(est.score)}`}>
              <span className={`text-4xl font-bold ${scoreColor(est.score)}`}>{est.score}</span>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Score</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {est.score >= 8 ? 'Excellent' : est.score >= 6 ? 'Good' : 'Below average'}
                </p>
              </div>
            </div>
          )}

          {/* Tags */}
          {est.tags && est.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {est.tags.map((tag) => (
                  <span key={tag} className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">{tag}</span>
                ))}
              </div>
            </div>
          )}

          {/* Details */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Details</p>
            <div className="space-y-1.5">
              {est.distanceKm !== undefined && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">📍</span>
                  <span>{est.distanceKm} km away</span>
                </div>
              )}
              {est.openUntil && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">🕐</span>
                  <span>Open until {est.openUntil}</span>
                </div>
              )}
              {est.hasAlcohol !== undefined && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">🍷</span>
                  <span>{est.hasAlcohol ? 'Serves alcohol' : 'No alcohol'}</span>
                </div>
              )}
              {est.hasReservations !== undefined && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">📅</span>
                  <span>{est.hasReservations ? 'Accepts reservations' : 'No reservations'}</span>
                </div>
              )}
              {est.hasDeals !== undefined && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">🏷️</span>
                  <span>{est.hasDeals ? 'Has deals' : 'No deals'}</span>
                </div>
              )}
            </div>
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
                      <span className="text-xs font-medium text-gray-700">
                        {r.authorName || r.authorUid?.slice(0, 12) || 'Unknown'}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${scoreColor(r.score)}`}>
                          {r.score ?? '—'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {r.createdAt ? new Date(r.createdAt.seconds * 1000).toLocaleDateString() : '—'}
                        </span>
                      </div>
                    </div>
                    {r.text && (
                      <p className="text-xs text-gray-600 line-clamp-2">{r.text}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions footer */}
        <div className="px-5 pt-4 pb-2 border-t border-gray-100 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            {!est.isActive && (
              <button
                onClick={() => { onApprove(est.id); onClose(); }}
                disabled={acting === est.id}
                className="flex-1 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg border border-green-500 transition-colors disabled:opacity-50"
              >
                Approve
              </button>
            )}
            <button
              onClick={() => { onClose(); onEdit(est); }}
              className="flex-1 py-2 bg-white hover:bg-gray-50 text-blue-600 text-sm font-semibold rounded-lg border border-blue-200 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => { onDelete(est.id, est.name); onClose(); }}
              disabled={acting === est.id}
              className="flex-1 py-2 bg-white hover:bg-red-50 text-red-500 text-sm font-semibold rounded-lg border border-red-200 transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </div>
          {/* Invite Owner */}
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="w-full py-2 bg-orange-50 hover:bg-orange-100 text-orange-600 text-sm font-semibold rounded-lg border border-orange-200 transition-colors mb-2"
          >
            {showInvite ? 'Cancel Invite' : 'Invite Owner'}
          </button>
          {showInvite && (
            <div className="space-y-2 pb-2">
              <input
                type="email"
                placeholder="Owner email *"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <input
                type="text"
                placeholder="Display name (optional)"
                value={inviteDisplayName}
                onChange={(e) => setInviteDisplayName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
              <button
                onClick={sendInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function EstablishmentsPage() {
  const [items, setItems] = useState<Est[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<Partial<Est>>({});
  const [toast, setToast] = useState('');
  const [selectedEst, setSelectedEst] = useState<Est | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Clear the selection whenever the filter changes — adjusted during render
  // (React's recommended alternative to a setState-in-effect reset).
  const [prevFilter, setPrevFilter] = useState<Filter>('all');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Real-time listener
  useEffect(() => {
    const q = query(collection(db, 'establishments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Est));
      setItems(docs);
      setLoading(false);
      // Keep selectedEst in sync
      setSelectedEst((prev) => {
        if (!prev) return null;
        return docs.find((e) => e.id === prev.id) ?? null;
      });
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = items.filter((e) => {
    if (filter === 'pending') return !e.isActive;
    if (filter === 'active') return e.isActive;
    return true;
  });

  if (prevFilter !== filter) {
    setPrevFilter(filter);
    setSelectedIds(new Set());
  }

  const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((e) => e.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const pending = items.filter((e) => !e.isActive);

  const approve = async (id: string) => {
    setActing(id);
    try {
      await updateDoc(doc(db, 'establishments', id), { isActive: true, status: 'active' });
      showToast('Establishment approved ✓');
    } finally { setActing(null); }
  };

  const reject = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setActing(id);
    try {
      await deleteDoc(doc(db, 'establishments', id));
      showToast('Establishment deleted');
    } finally { setActing(null); }
  };

  const approveAll = async () => {
    if (pending.length === 0) return;
    if (!confirm(`Approve all ${pending.length} pending establishments?`)) return;
    setBulkLoading(true);
    try {
      const batch = writeBatch(db);
      pending.forEach((e) => batch.update(doc(db, 'establishments', e.id), { isActive: true, status: 'active' }));
      await batch.commit();
      showToast(`${pending.length} establishments approved ✓`);
    } finally { setBulkLoading(false); }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} establishments? This cannot be undone.`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => batch.delete(doc(db, 'establishments', id)));
      await batch.commit();
      const count = selectedIds.size;
      setSelectedIds(new Set());
      showToast(`${count} establishments deleted`);
    } catch {
      showToast('Error deleting establishments');
    }
  };

  const bulkApprove = async () => {
    if (!confirm(`Approve ${selectedIds.size} establishments?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => batch.update(doc(db, 'establishments', id), { isActive: true, status: 'active' }));
      await batch.commit();
      const count = selectedIds.size;
      setSelectedIds(new Set());
      showToast(`${count} establishments approved ✓`);
    } catch {
      showToast('Error approving establishments');
    }
  };

  const saveEdit = async (id: string) => {
    setActing(id);
    try {
      await updateDoc(doc(db, 'establishments', id), editFields);
      setEditingId(null);
      showToast('Saved ✓');
    } finally { setActing(null); }
  };

  const startEdit = (e: Est) => {
    setEditingId(e.id);
    setEditFields({ name: e.name, type: e.type, area: e.area, priceRange: e.priceRange });
  };

  const filterCounts = {
    all: items.length,
    pending: items.filter((e) => !e.isActive).length,
    active: items.filter((e) => e.isActive).length,
  };

  return (
    <div className="p-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50 animate-in fade-in">
          {toast}
        </div>
      )}

      {/* Establishment detail drawer */}
      {selectedEst && (
        <EstDrawer
          est={selectedEst}
          onClose={() => setSelectedEst(null)}
          onApprove={approve}
          onEdit={(e) => { startEdit(e); setSelectedEst(null); }}
          onDelete={reject}
          acting={acting}
          showToast={showToast}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Establishments</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} total · {filterCounts.pending} pending · live updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => exportToCSV('establishments', filtered.map((e) => ({
              name: e.name,
              type: e.type || '',
              area: e.area || '',
              priceRange: e.priceRange || '',
              status: e.isActive ? 'active' : 'pending',
              createdAt: e.createdAt ? new Date(e.createdAt.seconds * 1000).toLocaleDateString() : '',
            })))}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-800 text-sm font-medium rounded-lg transition-colors"
          >
            <span>&#8595;</span> Export CSV
          </button>
          {pending.length > 0 && (
            <button
              onClick={approveAll}
              disabled={bulkLoading}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {bulkLoading ? '…' : `✓ Approve All (${pending.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'pending', 'active'] as Filter[]).map((f) => (
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

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 mb-4 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <span className="text-gray-500">·</span>
          <button
            onClick={bulkDelete}
            className="px-3 py-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Delete Selected
          </button>
          <button
            onClick={bulkApprove}
            className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-md transition-colors"
          >
            Approve Selected
          </button>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No establishments found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                  />
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Area</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Price</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => { if (editingId !== e.id) setSelectedEst(e); }}
                  className={`hover:bg-orange-50/40 transition-colors group ${editingId !== e.id ? 'cursor-pointer' : ''}`}
                >
                  <td className="px-4 py-3.5" onClick={(ev) => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(e.id)}
                      onChange={() => toggleSelectOne(e.id)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {editingId === e.id ? (
                      <input
                        className="border border-orange-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={editFields.name ?? ''}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => setEditFields((f) => ({ ...f, name: ev.target.value }))}
                      />
                    ) : e.name}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {editingId === e.id ? (
                      <input
                        className="border border-orange-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={editFields.type ?? ''}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => setEditFields((f) => ({ ...f, type: ev.target.value }))}
                      />
                    ) : e.type || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">
                    {editingId === e.id ? (
                      <input
                        className="border border-orange-300 rounded px-2 py-1 text-sm w-full focus:outline-none focus:ring-2 focus:ring-orange-400"
                        value={editFields.area ?? ''}
                        onClick={(ev) => ev.stopPropagation()}
                        onChange={(ev) => setEditFields((f) => ({ ...f, area: ev.target.value }))}
                      />
                    ) : e.area || '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600">{e.priceRange || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      e.isActive ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {e.isActive ? '● Active' : '○ Pending'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {editingId === e.id ? (
                        <>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); saveEdit(e.id); }}
                            disabled={acting === e.id}
                            className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); setEditingId(null); }}
                            className="text-xs font-semibold text-gray-400 hover:text-gray-600"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {!e.isActive && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); approve(e.id); }}
                              disabled={acting === e.id}
                              className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                            >
                              Approve
                            </button>
                          )}
                          <button
                            onClick={(ev) => { ev.stopPropagation(); startEdit(e); }}
                            className="text-xs font-semibold text-blue-500 hover:text-blue-700"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(ev) => { ev.stopPropagation(); reject(e.id, e.name); }}
                            disabled={acting === e.id}
                            className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                          >
                            Delete
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
