'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';
import type { Reservation } from '@/lib/types';
import { filterReservations, tsToMillis, formatDateTime } from '@/lib/owner-logic';

type Tab = 'today' | 'week' | 'upcoming' | 'past';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  seated: 'bg-green-100 text-green-700',
  no_show: 'bg-red-100 text-red-600',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function ReservationsPage() {
  const { establishmentIds } = useOwnerAuth();
  const [pickedEstId, setPickedEstId] = useState<string>('');
  // Active establishment is derived: the owner's explicit pick, else the first one.
  const selectedEstId = pickedEstId || establishmentIds[0] || '';
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  // `loading` is derived: true until the subscription for the active id resolves.
  const [loadedEstId, setLoadedEstId] = useState<string>('');
  const loading = !!selectedEstId && loadedEstId !== selectedEstId;
  const [acting, setActing] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  // Notes modal state
  const [notesReservation, setNotesReservation] = useState<Reservation | null>(null);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!selectedEstId) return;
    const q = query(
      collection(db, 'reservations'),
      where('estId', '==', selectedEstId),
      orderBy('scheduledAt', 'asc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReservations(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Reservation)));
      setLoadedEstId(selectedEstId);
    }, () => setLoadedEstId(selectedEstId));
    return unsub;
  }, [selectedEstId]);

  const filtered = filterReservations(reservations, tab);

  const callMarkReservation = async (
    reservationId: string,
    status: Reservation['status'],
    ownerNote?: string,
  ) => {
    const fn = httpsCallable(getFunctions(app, 'us-central1'), 'markReservation');
    const payload: Record<string, unknown> = { reservationId, status };
    if (ownerNote !== undefined) payload.ownerNote = ownerNote;
    await fn(payload);
  };

  const handleStatus = async (r: Reservation, status: Reservation['status']) => {
    setActing(r.id);
    try {
      await callMarkReservation(r.id, status);
      showToast(`Reservation marked as ${status.replace('_', ' ')}`);
    } catch {
      showToast('Error updating reservation', true);
    } finally {
      setActing(null);
    }
  };

  const openNotesModal = (r: Reservation) => {
    setNotesReservation(r);
    setNoteText(r.ownerNote ?? '');
  };

  const handleSaveNote = async () => {
    if (!notesReservation) return;
    setSavingNote(true);
    try {
      await callMarkReservation(notesReservation.id, notesReservation.status, noteText);
      showToast('Note saved');
      setNotesReservation(null);
    } catch {
      showToast('Error saving note', true);
    } finally {
      setSavingNote(false);
    }
  };

  const formatReservationTime = (r: Reservation): string =>
    formatDateTime(tsToMillis(r.scheduledAt));

  const TABS: { key: Tab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'upcoming', label: 'All Upcoming' },
    { key: 'past', label: 'Past' },
  ];

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

      {/* Notes Modal */}
      {notesReservation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-bold text-gray-900 mb-1">Add Owner Note</h2>
            <p className="text-xs text-gray-500 mb-4">
              Guest: {notesReservation.guestDisplayName ?? 'Unknown'} — {formatReservationTime(notesReservation)}
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              placeholder="Private note about this reservation…"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setNotesReservation(null)}
                className="px-4 py-2 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                disabled={savingNote}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
                style={{ backgroundColor: '#BF5B2E' }}
              >
                {savingNote ? 'Saving…' : 'Save Note'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
          <p className="text-sm text-gray-500 mt-1">{reservations.length} total · live updates</p>
        </div>
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
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === key ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={tab === key ? { backgroundColor: '#BF5B2E' } : {}}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No reservations in this view.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Guest</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Party Size</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Date &amp; Time</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{r.guestDisplayName ?? 'Unknown'}</p>
                    {r.guestEmail && (
                      <p className="text-xs text-gray-400 mt-0.5">{r.guestEmail}</p>
                    )}
                    {r.ownerNote && (
                      <p className="text-xs text-gray-500 mt-1 italic line-clamp-1">Note: {r.ownerNote}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 font-medium text-gray-700">{r.partySize}</td>
                  <td className="px-5 py-3.5 text-gray-600 text-xs">{formatReservationTime(r)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-500'}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-3">
                      {r.status === 'pending' && (
                        <button
                          onClick={() => handleStatus(r, 'confirmed')}
                          disabled={acting === r.id}
                          className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        >
                          {acting === r.id ? '…' : 'Confirm'}
                        </button>
                      )}
                      {r.status === 'confirmed' && (
                        <button
                          onClick={() => handleStatus(r, 'seated')}
                          disabled={acting === r.id}
                          className="text-xs font-semibold text-green-600 hover:text-green-800 disabled:opacity-50"
                        >
                          {acting === r.id ? '…' : 'Seated'}
                        </button>
                      )}
                      {(r.status === 'pending' || r.status === 'confirmed') && (
                        <button
                          onClick={() => handleStatus(r, 'no_show')}
                          disabled={acting === r.id}
                          className="text-xs font-semibold text-red-400 hover:text-red-600 disabled:opacity-50"
                        >
                          No-show
                        </button>
                      )}
                      <button
                        onClick={() => openNotesModal(r)}
                        className="text-xs font-semibold text-gray-500 hover:text-gray-700"
                      >
                        Notes
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
