'use client';

import { useEffect, useState } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  query, orderBy, onSnapshot, Timestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Deal {
  id: string;
  title: string;
  description: string;
  estId: string;
  estName?: string;
  discountPercent?: number;
  discountLabel: string;
  isActive: boolean;
  expiresAt?: { seconds: number };
  createdAt?: { seconds: number };
}

const EMPTY_FORM = {
  title: '',
  description: '',
  estId: '',
  estName: '',
  discountLabel: '',
  discountPercent: '',
  expiresAt: '',
};

export default function DealsPage() {
  const [items, setItems] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Clear the selection whenever the filter changes — adjusted during render
  // (React's recommended alternative to a setState-in-effect reset).
  const [prevFilter, setPrevFilter] = useState(filterActive);
  if (prevFilter !== filterActive) {
    setPrevFilter(filterActive);
    setSelectedIds(new Set());
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'deals'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Deal)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = items.filter((d) => {
    if (filterActive === 'active') return d.isActive;
    if (filterActive === 'inactive') return !d.isActive;
    return true;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((d) => d.id)));
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

  const toggleActive = async (deal: Deal) => {
    setActing(deal.id);
    try {
      await updateDoc(doc(db, 'deals', deal.id), { isActive: !deal.isActive });
      showToast(`Deal ${deal.isActive ? 'deactivated' : 'activated'} ✓`);
    } finally { setActing(null); }
  };

  const deleteDeal = async (deal: Deal) => {
    if (!confirm(`Delete "${deal.title}"?`)) return;
    setActing(deal.id);
    try {
      await deleteDoc(doc(db, 'deals', deal.id));
      showToast('Deal deleted');
    } finally { setActing(null); }
  };

  const bulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} deals?`)) return;
    try {
      const batch = writeBatch(db);
      selectedIds.forEach((id) => batch.delete(doc(db, 'deals', id)));
      await batch.commit();
      const count = selectedIds.size;
      setSelectedIds(new Set());
      showToast(`${count} deals deleted`);
    } catch {
      showToast('Error deleting deals');
    }
  };

  const createDeal = async () => {
    if (!form.title || !form.estId) {
      showToast('Title and Venue ID are required.');
      return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, 'deals'), {
        title: form.title,
        description: form.description,
        estId: form.estId,
        estName: form.estName || form.estId,
        discountLabel: form.discountLabel || (form.discountPercent ? `${form.discountPercent}% off` : 'Special offer'),
        discountPercent: form.discountPercent ? parseInt(form.discountPercent) : null,
        isActive: true,
        expiresAt: form.expiresAt ? Timestamp.fromDate(new Date(form.expiresAt)) : null,
        createdAt: Timestamp.now(),
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      showToast('Deal created ✓');
    } finally { setSaving(false); }
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
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          <p className="text-sm text-gray-500 mt-1">
            {items.length} total · {items.filter(d => d.isActive).length} active · live updates
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {showForm ? '✕ Cancel' : '+ New Deal'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-orange-200 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 mb-4">New Deal</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Free Appetiser with Main"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue ID *</label>
              <input value={form.estId} onChange={e => setForm(f => ({ ...f, estId: e.target.value }))}
                placeholder="e.g. the-social-lounge"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Venue Name</label>
              <input value={form.estName} onChange={e => setForm(f => ({ ...f, estName: e.target.value }))}
                placeholder="e.g. The Social Lounge"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
              <input type="number" value={form.discountPercent} onChange={e => setForm(f => ({ ...f, discountPercent: e.target.value }))}
                placeholder="e.g. 20"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount Label</label>
              <input value={form.discountLabel} onChange={e => setForm(f => ({ ...f, discountLabel: e.target.value }))}
                placeholder="e.g. 20% off all mains"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Expires At</label>
              <input type="date" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe the deal…" rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={createDeal} disabled={saving}
              className="px-5 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
              {saving ? 'Creating…' : 'Create Deal'}
            </button>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {(['all', 'active', 'inactive'] as const).map((f) => (
          <button key={f} onClick={() => setFilterActive(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filterActive === f ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
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
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            No deals yet. Click <strong>+ New Deal</strong> to create one.
          </div>
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
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Deal</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Venue</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Discount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3.5">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(d.id)}
                      onChange={() => toggleSelectOne(d.id)}
                      className="rounded border-gray-300 text-orange-500 focus:ring-orange-400"
                    />
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{d.title}</p>
                    {d.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{d.description}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">{d.estName || d.estId}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                      {d.discountLabel || (d.discountPercent ? `${d.discountPercent}%` : 'Deal')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {d.expiresAt ? new Date(d.expiresAt.seconds * 1000).toLocaleDateString() : 'No expiry'}
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      d.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {d.isActive ? '● Active' : '○ Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      <button onClick={() => toggleActive(d)} disabled={acting === d.id}
                        className={`text-xs font-semibold disabled:opacity-50 transition-colors ${
                          d.isActive ? 'text-gray-500 hover:text-gray-700' : 'text-green-600 hover:text-green-800'
                        }`}>
                        {acting === d.id ? '…' : d.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => deleteDeal(d)} disabled={acting === d.id}
                        className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50">
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
