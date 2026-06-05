'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db, app } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';

interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl?: string;
  sentAt: { seconds: number } | null;
  recipientCount: number;
}

export default function AnnouncementsPage() {
  const { establishmentIds } = useOwnerAuth();
  const [selectedEstId, setSelectedEstId] = useState<string>('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [titleError, setTitleError] = useState('');
  const [bodyError, setBodyError] = useState('');

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 4000);
  };

  useEffect(() => {
    if (establishmentIds.length > 0 && !selectedEstId) {
      setSelectedEstId(establishmentIds[0]);
    }
  }, [establishmentIds, selectedEstId]);

  // Real-time listener for announcement history
  useEffect(() => {
    if (!selectedEstId) return;
    setListLoading(true);
    const q = query(
      collection(db, 'establishments', selectedEstId, 'announcements'),
      orderBy('sentAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setAnnouncements(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)),
      );
      setListLoading(false);
    }, () => setListLoading(false));
    return unsub;
  }, [selectedEstId]);

  const validate = (): boolean => {
    let valid = true;
    if (!title.trim()) {
      setTitleError('Title is required.');
      valid = false;
    } else if (title.length > 65) {
      setTitleError('Title must be 65 characters or fewer.');
      valid = false;
    } else {
      setTitleError('');
    }
    if (!body.trim()) {
      setBodyError('Body is required.');
      valid = false;
    } else if (body.length > 240) {
      setBodyError('Body must be 240 characters or fewer.');
      valid = false;
    } else {
      setBodyError('');
    }
    return valid;
  };

  const handleSend = async () => {
    if (!validate()) return;
    setSending(true);
    try {
      const broadcastAnnouncement = httpsCallable(
        getFunctions(app, 'us-central1'),
        'broadcastAnnouncement',
      );
      const result = await broadcastAnnouncement({
        estId: selectedEstId,
        title: title.trim(),
        body: body.trim(),
        imageUrl: imageUrl.trim() || undefined,
      });
      const { sent } = result.data as { sent: number };
      setTitle('');
      setBody('');
      setImageUrl('');
      setTitleError('');
      setBodyError('');
      showToast(`✓ Sent to ${sent} followers`);
    } catch {
      showToast('Failed to send announcement. Please try again.', true);
    } finally {
      setSending(false);
    }
  };

  const formatDate = (sentAt: Announcement['sentAt']): string => {
    if (!sentAt?.seconds) return '';
    return new Date(sentAt.seconds * 1000).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const truncate = (text: string, max: number) =>
    text.length > max ? text.slice(0, max) + '…' : text;

  return (
    <div className="p-8 max-w-3xl mx-auto">
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
          <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-500 mt-1">Send push notifications to all followers</p>
        </div>
        {establishmentIds.length > 1 && (
          <select
            value={selectedEstId}
            onChange={(e) => setSelectedEstId(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
          >
            {establishmentIds.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        )}
      </div>

      {/* Compose card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
        <h2 className="text-base font-bold text-gray-900 mb-5">New Announcement</h2>

        {/* Title */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Title *</label>
            <span className={`text-xs ${title.length > 55 ? 'text-amber-500' : 'text-gray-400'}`}>
              {title.length}/65
            </span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={65}
            placeholder="e.g. Weekend Special — 20% off drinks!"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${
              titleError ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-orange-200'
            }`}
          />
          {titleError && <p className="text-xs text-red-500 mt-1">{titleError}</p>}
        </div>

        {/* Body */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-gray-600">Message *</label>
            <span className={`text-xs ${body.length > 200 ? 'text-amber-500' : 'text-gray-400'}`}>
              {body.length}/240
            </span>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={240}
            rows={4}
            placeholder="Write your announcement message here…"
            className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 resize-none ${
              bodyError ? 'border-red-400 focus:ring-red-200' : 'border-gray-200 focus:ring-orange-200'
            }`}
          />
          {bodyError && <p className="text-xs text-red-500 mt-1">{bodyError}</p>}
        </div>

        {/* Image URL */}
        <div className="mb-6">
          <label className="block text-xs font-medium text-gray-600 mb-1">Image URL (optional)</label>
          <input
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 px-5 py-2.5 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors"
            style={{ backgroundColor: '#BF5B2E' }}
          >
            {sending && (
              <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin" />
            )}
            {sending ? 'Sending…' : '📢 Send to All Followers'}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-4">Announcement History</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {listLoading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
            </div>
          ) : announcements.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm">
              No announcements sent yet
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {announcements.map((a) => (
                <div key={a.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{a.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {truncate(a.body, 80)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{formatDate(a.sentAt)}</p>
                      <p className="text-xs font-medium mt-0.5" style={{ color: '#BF5B2E' }}>
                        📢 {a.recipientCount ?? 0} followers
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
