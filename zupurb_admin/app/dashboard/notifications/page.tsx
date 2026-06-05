'use client';

import { useEffect, useState } from 'react';
import {
  collection, addDoc, query, orderBy, onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface AdminNotification {
  id: string;
  title: string;
  body: string;
  audience: string;
  scheduledFor: { seconds: number } | null;
  status: 'queued' | 'sent' | 'failed';
  createdAt?: { seconds: number };
}

const AUDIENCE_OPTIONS = [
  'All Users',
  'Bronze Tier',
  'Silver Tier',
  'Gold Tier',
  'Platinum Tier',
];

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState('All Users');
  const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>('now');
  const [scheduledFor, setScheduledFor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [history, setHistory] = useState<AdminNotification[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    const q = query(collection(db, 'adminNotifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminNotification)));
      setHistoryLoading(false);
    }, () => setHistoryLoading(false));
    return unsub;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    setSubmitting(true);
    try {
      const schedTs = scheduleMode === 'later' && scheduledFor
        ? Timestamp.fromDate(new Date(scheduledFor))
        : null;
      await addDoc(collection(db, 'adminNotifications'), {
        title: title.trim(),
        body: body.trim(),
        audience,
        scheduledFor: schedTs,
        status: 'queued',
        createdAt: Timestamp.now(),
      });
      setTitle('');
      setBody('');
      setAudience('All Users');
      setScheduleMode('now');
      setScheduledFor('');
      showToast('Notification queued ✓');
    } catch {
      showToast('Failed to queue notification');
    } finally { setSubmitting(false); }
  };

  const statusBadge: Record<string, string> = {
    queued: 'bg-amber-100 text-amber-700',
    sent: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-600',
  };

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg z-50">
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">Compose and queue push notifications for app users</p>
      </div>

      {/* Compose form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 max-w-2xl">
        <h2 className="text-sm font-semibold text-gray-700 mb-5">Compose Notification</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Notification title…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Body <span className="text-red-400">*</span>
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={3}
              placeholder="Notification message…"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
              Audience
            </label>
            <select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
            >
              {AUDIENCE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Schedule
            </label>
            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value="now"
                  checked={scheduleMode === 'now'}
                  onChange={() => setScheduleMode('now')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-700">Send Now</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="schedule"
                  value="later"
                  checked={scheduleMode === 'later'}
                  onChange={() => setScheduleMode('later')}
                  className="accent-orange-500"
                />
                <span className="text-sm text-gray-700">Schedule for Later</span>
              </label>
            </div>
            {scheduleMode === 'later' && (
              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !body.trim()}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {submitting ? 'Queuing…' : scheduleMode === 'now' ? 'Send Now' : 'Schedule Notification'}
          </button>
        </form>
      </div>

      {/* History table */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Notification History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {historyLoading ? (
            <div className="p-8 text-center">
              <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : history.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No notifications sent yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Audience</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {history.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{n.body}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-600">{n.audience}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge[n.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">
                      {n.scheduledFor
                        ? new Date(n.scheduledFor.seconds * 1000).toLocaleString()
                        : n.createdAt
                        ? new Date(n.createdAt.seconds * 1000).toLocaleString()
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
