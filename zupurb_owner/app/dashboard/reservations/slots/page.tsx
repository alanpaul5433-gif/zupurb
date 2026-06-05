'use client';

import { useEffect, useState } from 'react';
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';

interface ReservationSlot {
  id: string;
  dayOfWeek: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string;
  endTime: string;
  maxCovers: number;
  isActive: boolean;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
}

interface SlotFormData {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxCovers: number;
  isActive: boolean;
}

const defaultForm = (): SlotFormData => ({
  dayOfWeek: 1,
  startTime: '18:00',
  endTime: '20:00',
  maxCovers: 20,
  isActive: true,
});

export default function ReservationSlotsPage() {
  const { establishmentIds } = useOwnerAuth();
  const [estId, setEstId] = useState('');
  const [slots, setSlots] = useState<ReservationSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<SlotFormData>(defaultForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (establishmentIds.length > 0 && !estId) {
      setEstId(establishmentIds[0]);
    }
  }, [establishmentIds, estId]);

  useEffect(() => {
    if (!estId) return;
    setLoading(true);
    const q = query(
      collection(db, 'establishments', estId, 'reservationSlots'),
      orderBy('dayOfWeek', 'asc'),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setSlots(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ReservationSlot)));
        setLoading(false);
      },
      () => setLoading(false),
    );
    return unsub;
  }, [estId]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.startTime) errors.startTime = 'Start time is required';
    if (!form.endTime) errors.endTime = 'End time is required';
    if (form.startTime && form.endTime && form.endTime <= form.startTime) {
      errors.endTime = 'End time must be after start time';
    }
    if (!form.maxCovers || form.maxCovers < 1) {
      errors.maxCovers = 'Max covers must be at least 1';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdd = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'establishments', estId, 'reservationSlots'), {
        dayOfWeek: form.dayOfWeek,
        startTime: form.startTime,
        endTime: form.endTime,
        maxCovers: form.maxCovers,
        isActive: form.isActive,
      });
      showToast('Slot added successfully');
      setShowForm(false);
      setForm(defaultForm());
      setFormErrors({});
    } catch {
      showToast('Error adding slot', true);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (slot: ReservationSlot) => {
    try {
      await updateDoc(doc(db, 'establishments', estId, 'reservationSlots', slot.id), {
        isActive: !slot.isActive,
      });
    } catch {
      showToast('Error updating slot', true);
    }
  };

  const handleDelete = async (slotId: string) => {
    try {
      await deleteDoc(doc(db, 'establishments', estId, 'reservationSlots', slotId));
      showToast('Slot deleted');
    } catch {
      showToast('Error deleting slot', true);
    }
  };

  const slotsByDay = DAYS.map((_, i) => slots.filter((s) => s.dayOfWeek === i));

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

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reservation Slots</h1>
          <p className="text-sm text-gray-500 mt-1">Manage when guests can book tables</p>
        </div>
        <div className="flex items-center gap-3">
          {establishmentIds.length > 1 && (
            <select
              value={estId}
              onChange={(e) => setEstId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
            >
              {establishmentIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => { setShowForm((v) => !v); setFormErrors({}); }}
            className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors"
            style={{ backgroundColor: '#BF5B2E' }}
          >
            {showForm ? 'Cancel' : '+ Add Slot'}
          </button>
        </div>
      </div>

      {/* Add Slot Form Panel */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">New Slot</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Day of Week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              >
                {DAYS.map((day, i) => (
                  <option key={day} value={i}>{day}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start Time</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
              {formErrors.startTime && (
                <p className="text-xs text-red-500 mt-1">{formErrors.startTime}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End Time</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
              {formErrors.endTime && (
                <p className="text-xs text-red-500 mt-1">{formErrors.endTime}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Covers</label>
              <input
                type="number"
                min={1}
                max={500}
                value={form.maxCovers}
                onChange={(e) => setForm((f) => ({ ...f, maxCovers: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
              />
              {formErrors.maxCovers && (
                <p className="text-xs text-red-500 mt-1">{formErrors.maxCovers}</p>
              )}
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="slot-active"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="slot-active" className="text-sm text-gray-700 font-medium">Active</label>
            </div>
          </div>
          <div className="flex gap-2 mt-5 justify-end">
            <button
              onClick={() => { setShowForm(false); setForm(defaultForm()); setFormErrors({}); }}
              className="px-4 py-2 text-gray-600 text-sm font-semibold rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="px-4 py-2 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
              style={{ backgroundColor: '#BF5B2E' }}
            >
              {saving ? 'Saving…' : 'Save Slot'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }}
          />
        </div>
      ) : slots.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm">No reservation slots yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {DAYS.map((day, i) => {
            const daySlots = slotsByDay[i];
            if (daySlots.length === 0) return null;
            return (
              <div key={day}>
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{day}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {daySlots.map((slot) => (
                    <div
                      key={slot.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">
                            {formatTime(slot.startTime)} – {formatTime(slot.endTime)}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Up to {slot.maxCovers} guests</p>
                        </div>
                        <button
                          onClick={() => handleDelete(slot.id)}
                          title="Delete slot"
                          className="text-gray-300 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                        >
                          {/* Trash icon */}
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleToggleActive(slot)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                            slot.isActive ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                              slot.isActive ? 'translate-x-4' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-gray-500">{slot.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
