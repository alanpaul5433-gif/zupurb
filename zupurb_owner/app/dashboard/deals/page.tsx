'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';
import type { Deal } from '@/lib/types';
import { dollarsToCents, parsePointCost, formatExpiry } from '@/lib/owner-logic';

const EMPTY_FORM = {
  title: '',
  description: '',
  pointCost: '',
  originalValueDollars: '',
  expiresAt: '',
  isActive: true,
};

export default function DealsPage() {
  const { establishmentIds } = useOwnerAuth();
  const [pickedEstId, setPickedEstId] = useState<string>('');
  // Active establishment is derived: the owner's explicit pick, else the first one.
  const selectedEstId = pickedEstId || establishmentIds[0] || '';
  const [deals, setDeals] = useState<Deal[]>([]);
  // `loading` is derived: true until the subscription for the active id resolves.
  const [loadedEstId, setLoadedEstId] = useState<string>('');
  const loading = !!selectedEstId && loadedEstId !== selectedEstId;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!selectedEstId) return;
    const q = query(
      collection(db, 'establishments', selectedEstId, 'deals'),
      orderBy('isActive', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setDeals(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)));
      setLoadedEstId(selectedEstId);
    }, () => setLoadedEstId(selectedEstId));
    return unsub;
  }, [selectedEstId]);

  const createDeal = async () => {
    if (!form.title.trim()) {
      showToast('Title is required', true);
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'establishments', selectedEstId, 'deals'), {
        title: form.title.trim(),
        description: form.description.trim(),
        pointCost: parsePointCost(form.pointCost),
        originalValueCents: dollarsToCents(form.originalValueDollars),
        expiresAt: form.expiresAt ? Timestamp.fromDate(new Date(form.expiresAt)) : null,
        isActive: form.isActive,
        redemptionsCount: 0,
        createdAt: Timestamp.now(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast('Deal created');
    } catch {
      showToast('Error creating deal', true);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (deal: Deal) => {
    setActing(deal.id);
    try {
      await updateDoc(doc(db, 'establishments', selectedEstId, 'deals', deal.id), {
        isActive: !deal.isActive,
      });
      showToast(`Deal ${deal.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      showToast('Error updating deal', true);
    } finally {
      setActing(null);
    }
  };

  const deleteDeal = async (deal: Deal) => {
    if (!confirm(`Delete "${deal.title}"?`)) return;
    setActing(deal.id);
    try {
      await deleteDoc(doc(db, 'establishments', selectedEstId, 'deals', deal.id));
      showToast('Deal deleted');
    } catch {
      showToast('Error deleting deal', true);
    } finally {
      setActing(null);
    }
  };

  return (
    <div className="p-8">
      {toast && (
        <div
          className="fixed top-4 right-4 bg-white border-2 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50"
          style={{ borderColor: toastError ? '#EF4444' : '#BF5B2E', color: toastError ? '#EF4444' : '#BF5B2E' }}
        >
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {deals.length} total · {deals.filter((d) => d.isActive).length} active · live updates
          </p>
        </div>
        <div className="flex items-center gap-3">
          {establishmentIds.length > 1 && (
            <select
              value={selectedEstId}
              onChange={(e) => setPickedEstId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
            >
              {establishmentIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors"
            style={{ backgroundColor: '#BF5B2E' }}
          >
            {showForm ? '✕ Cancel' : '+ New Deal'}
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border-2 p-6 mb-6 shadow-sm" style={{ borderColor: '#BF5B2E33' }}>
          <h2 className="text-sm font-bold text-gray-800 mb-4">New Deal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Free Dessert with Main"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Point Cost</label>
              <input
                type="number"
                min="0"
                value={form.pointCost}
                onChange={(e) => setForm((f) => ({ ...f, pointCost: e.target.value }))}
                placeholder="e.g. 500"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Original Value ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.originalValueDollars}
                onChange={(e) => setForm((f) => ({ ...f, originalValueDollars: e.target.value }))}
                placeholder="e.g. 12.50"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expiry Date</label>
              <input
                type="date"
                value={form.expiresAt}
                onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="deal-active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="deal-active" className="text-sm font-medium text-gray-700">Active immediately</label>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the deal…"
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={createDeal}
              disabled={saving}
              className="px-5 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#BF5B2E' }}
            >
              {saving ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
          </div>
        ) : deals.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No deals yet. Click <strong>+ New Deal</strong> to create one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Points</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Value</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expiry</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Redemptions</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {deals.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{d.title}</p>
                    {d.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: '#BF5B2E22', color: '#BF5B2E' }}>
                      {d.pointCost} pts
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-sm">
                    ${(d.originalValueCents / 100).toFixed(2)}
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{formatExpiry(d.expiresAt)}</td>
                  <td className="px-5 py-3.5 text-gray-700 font-medium">{d.redemptionsCount ?? 0}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={() => toggleActive(d)}
                        disabled={acting === d.id}
                        className={`text-xs font-semibold disabled:opacity-50 transition-colors ${
                          d.isActive ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-800'
                        }`}
                      >
                        {acting === d.id ? '…' : d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => deleteDeal(d)}
                        disabled={acting === d.id}
                        className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                      >
                        Delete
                      </button>
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
