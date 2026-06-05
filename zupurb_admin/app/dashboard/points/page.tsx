'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AppUser {
  id: string;
  displayName: string;
  loyaltyTier: string;
  pointsBalance: number;
}

interface LedgerEntry {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  adjustedBy?: string;
  createdAt?: { seconds: number } | Date;
}

type Tab = 'adjust' | 'ledger';
type LedgerTypeFilter = 'all' | 'credit' | 'debit';

// ─── Full Ledger Tab ────────────────────────────────────────────────────────

function FullLedgerTab() {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<LedgerTypeFilter>('all');

  useEffect(() => {
    const q = query(
      collection(db, 'pointsLedger'),
      orderBy('createdAt', 'desc'),
      limit(100),
    );
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  const filtered = typeFilter === 'all'
    ? entries
    : entries.filter((e) => e.type === typeFilter);

  const totalCredits = entries.filter((e) => e.type === 'credit').reduce((sum, e) => sum + (e.amount ?? 0), 0);
  const totalDebits = entries.filter((e) => e.type === 'debit').reduce((sum, e) => sum + (e.amount ?? 0), 0);

  const formatDate = (val: LedgerEntry['createdAt']) => {
    if (!val) return '—';
    if (val instanceof Date) return val.toLocaleDateString();
    if ('seconds' in val) return new Date(val.seconds * 1000).toLocaleDateString();
    return '—';
  };

  return (
    <div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide">Total Credits</p>
          <p className="text-2xl font-bold text-green-700 mt-1">+{totalCredits.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-600 uppercase tracking-wide">Total Debits</p>
          <p className="text-2xl font-bold text-red-700 mt-1">-{totalDebits.toLocaleString()}</p>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'credit', 'debit'] as LedgerTypeFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              typeFilter === f
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center">
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No ledger entries found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500 max-w-[120px]">
                    <span className="truncate block">{e.userId ? e.userId.slice(0, 12) + '…' : '—'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-bold text-sm ${e.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                      {e.type === 'credit' ? '+' : '-'}{e.amount ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      e.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[180px]">
                    <span className="truncate block">{e.reason || '—'}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{e.adjustedBy || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Adjust Points Tab ──────────────────────────────────────────────────────

function AdjustPointsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<'credit' | 'debit'>('credit');
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<Array<LedgerEntry>>([]);

  const searchUsers = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'users'),
          where('displayName', '>=', searchTerm),
          where('displayName', '<=', searchTerm + ''),
          limit(10)
        )
      );
      setSearchResults(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AppUser)));
    } catch {
      setError('Search failed. Try searching by the exact display name.');
    } finally {
      setSearching(false);
    }
  };

  const selectUser = (u: AppUser) => {
    setSelectedUser(u);
    setSearchResults([]);
    setSearchTerm(u.displayName);
    setSuccess('');
    setError('');
    loadHistory(u.id);
  };

  const loadHistory = async (uid: string) => {
    try {
      const snap = await getDocs(
        query(collection(db, 'pointsLedger'), where('userId', '==', uid), limit(10))
      );
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as LedgerEntry)));
    } catch {
      // pointsLedger may be empty — ignore
    }
  };

  const applyAdjustment = async () => {
    if (!selectedUser) return;
    const pts = parseInt(amount);
    if (isNaN(pts) || pts <= 0) {
      setError('Enter a valid positive number.');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter a reason.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const delta = type === 'credit' ? pts : -pts;
      const newBalance = Math.max(0, (selectedUser.pointsBalance ?? 0) + delta);

      await updateDoc(doc(db, 'users', selectedUser.id), {
        pointsBalance: newBalance,
      });

      await setDoc(
        doc(db, 'userBalances', selectedUser.id),
        { userId: selectedUser.id, balance: newBalance, updatedAt: new Date() },
        { merge: true }
      );

      const ledgerRef = doc(collection(db, 'pointsLedger'));
      await setDoc(ledgerRef, {
        userId: selectedUser.id,
        amount: pts,
        type,
        reason: reason.trim(),
        adjustedBy: 'admin',
        createdAt: new Date(),
      });

      setSelectedUser({ ...selectedUser, pointsBalance: newBalance });
      setSuccess(`✓ ${type === 'credit' ? '+' : '-'}${pts} pts applied. New balance: ${newBalance.toLocaleString()} pts`);
      setAmount('');
      setReason('');
      loadHistory(selectedUser.id);
    } catch (e) {
      setError(`Failed: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (val: LedgerEntry['createdAt']) => {
    if (!val) return '—';
    if (val instanceof Date) return val.toLocaleDateString();
    if ('seconds' in val) return new Date((val as { seconds: number }).seconds * 1000).toLocaleDateString();
    return '—';
  };

  return (
    <div className="max-w-2xl">
      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Find User</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setSelectedUser(null); }}
            onKeyDown={(e) => e.key === 'Enter' && searchUsers()}
            placeholder="Type display name…"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={searchUsers}
            disabled={searching}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {searching ? '…' : 'Search'}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
            {searchResults.map((u) => (
              <button
                key={u.id}
                onClick={() => selectUser(u)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-50 text-left text-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">{u.displayName}</p>
                  <p className="text-xs text-gray-400 font-mono">{u.id.slice(0, 16)}…</p>
                </div>
                <span className="text-orange-600 font-semibold">{(u.pointsBalance ?? 0).toLocaleString()} pts</span>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="mt-3 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-3">
            <div>
              <p className="font-semibold text-gray-900 text-sm">{selectedUser.displayName}</p>
              <p className="text-xs text-gray-500 mt-0.5">Current balance: <span className="font-bold text-orange-600">{(selectedUser.pointsBalance ?? 0).toLocaleString()} pts</span></p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
              selectedUser.loyaltyTier === 'gold' ? 'bg-yellow-100 text-yellow-700'
                : selectedUser.loyaltyTier === 'platinum' ? 'bg-blue-100 text-blue-700'
                : selectedUser.loyaltyTier === 'silver' ? 'bg-gray-100 text-gray-600'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {selectedUser.loyaltyTier || 'bronze'}
            </span>
          </div>
        )}
      </div>

      {/* Adjustment form */}
      {selectedUser && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Adjustment</h2>

          <div className="flex gap-2 mb-4">
            {(['credit', 'debit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                  type === t
                    ? t === 'credit'
                      ? 'bg-green-500 text-white border-green-500'
                      : 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {t === 'credit' ? '+ Credit' : '− Debit'}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount (points)</label>
              <input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 100"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Reason</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Compensation for review error"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
          )}
          {success && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-700">{success}</div>
          )}

          <button
            onClick={applyAdjustment}
            disabled={saving || !amount || !reason}
            className="mt-4 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Applying…' : `Apply ${type === 'credit' ? '+' : '-'}${amount || '?'} pts`}
          </button>
        </div>
      )}

      {selectedUser && history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Admin Adjustments</h2>
          <div className="space-y-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className={`font-semibold ${h.type === 'credit' ? 'text-green-600' : 'text-red-500'}`}>
                    {h.type === 'credit' ? '+' : '-'}{h.amount} pts
                  </span>
                  <span className="text-gray-500 ml-2">{h.reason}</span>
                </div>
                <span className="text-xs text-gray-400">{formatDate(h.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function PointsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('adjust');

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Points</h1>
        <p className="text-sm text-gray-500 mt-1">Adjust user points balances and view the full ledger.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'adjust', label: 'Adjust Points' },
          { key: 'ledger', label: 'Full Ledger' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeTab === t.key
                ? 'bg-orange-500 text-white border-orange-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'adjust' ? <AdjustPointsTab /> : <FullLedgerTab />}
    </div>
  );
}
