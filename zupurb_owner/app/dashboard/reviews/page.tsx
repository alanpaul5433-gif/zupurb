'use client';

import { useEffect, useState } from 'react';
import {
  collection, query, orderBy, onSnapshot,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';
import { db, app } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';
import type { Review } from '@/lib/types';
import {
  filterReviews, reviewCounts, verificationTier, formatTsDate,
} from '@/lib/owner-logic';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

type Tab = 'all' | 'positive' | 'negative' | 'responded';

interface WeeklyPoint {
  week: string;
  avg: number;
}

export default function ReviewsPage() {
  const { establishmentIds } = useOwnerAuth();
  const [pickedEstId, setPickedEstId] = useState<string>('');
  // Active establishment is derived: the owner's explicit pick, else the first one.
  const selectedEstId = pickedEstId || establishmentIds[0] || '';
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<Tab>('all');
  // `loading` is derived: true until the subscription for the active id resolves.
  const [loadedEstId, setLoadedEstId] = useState<string>('');
  const loading = !!selectedEstId && loadedEstId !== selectedEstId;
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);
  const [trendData, setTrendData] = useState<WeeklyPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(false);
  const [verificationRate, setVerificationRate] = useState<number | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (!selectedEstId) return;
    const q = query(
      collection(db, 'establishments', selectedEstId, 'reviews'),
      orderBy('createdAt', 'desc'),
    );
    const unsub = onSnapshot(q, (snap) => {
      setReviews(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Review)));
      setLoadedEstId(selectedEstId);
    }, () => setLoadedEstId(selectedEstId));
    return unsub;
  }, [selectedEstId]);

  // Load trend data + verification rate
  useEffect(() => {
    if (!selectedEstId) return;
    const loadTrend = async () => {
      setTrendLoading(true);
      try {
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(
          `https://us-central1-zupurb-9580f.cloudfunctions.net/getOwnerAnalytics?estId=${selectedEstId}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setTrendData(data.weeklyScores ?? []);
          if (typeof data.verificationRate === 'number') {
            setVerificationRate(data.verificationRate);
          }
        }
      } catch {
        // Trend data is non-critical; fail silently
      } finally {
        setTrendLoading(false);
      }
    };
    loadTrend();
  }, [selectedEstId]);

  const filtered = filterReviews(reviews, tab);
  const counts = reviewCounts(reviews);
  const formatDate = (createdAt: unknown): string => formatTsDate(createdAt);

  const handleSubmitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      const fn = httpsCallable(getFunctions(app, 'us-central1'), 'respondToReview');
      await fn({ reviewId, estId: selectedEstId, response: replyText.trim() });
      setReplyingTo(null);
      setReplyText('');
      showToast('Reply posted');
    } catch {
      showToast('Error posting reply', true);
    } finally {
      setSubmitting(false);
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

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-sm text-gray-500 mt-1">{reviews.length} total · live updates</p>
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

      {/* Score trend chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-bold text-gray-800 mb-4">Score Trend (12 Weeks)</h2>
        {trendLoading ? (
          <div className="h-32 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
          </div>
        ) : trendData.length === 0 ? (
          <div className="h-32 flex items-center justify-center">
            <p className="text-sm text-gray-400">No trend data available yet.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: '#9CA3AF' }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
              />
              <Line
                type="monotone"
                dataKey="avg"
                stroke="#BF5B2E"
                strokeWidth={2}
                dot={{ fill: '#BF5B2E', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {(['all', 'positive', 'negative', 'responded'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              tab === t ? 'text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
            style={tab === t ? { backgroundColor: '#BF5B2E' } : {}}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
            <span className="ml-1.5 opacity-60 text-xs">({counts[t]})</span>
          </button>
        ))}
      </div>

      {/* Verification Rate Banner */}
      {verificationRate !== null && (
        <div
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium mb-5 ${
            {
              high: 'bg-green-50 text-green-700',
              mid: 'bg-amber-50 text-amber-700',
              low: 'bg-gray-100 text-gray-500',
            }[verificationTier(verificationRate)]
          }`}
        >
          <span>✓</span>
          <span>{verificationRate}% of your reviews are verified visits</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
          No reviews in this category.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm shrink-0 ${
                      r.rawScore >= 4 ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  >
                    {r.rawScore.toFixed(1)}
                  </span>
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.authorName ?? 'Anonymous'}</p>
                    <p className="text-xs text-gray-400">{formatDate(r.createdAt)}</p>
                  </div>
                </div>
              </div>

              {r.title && <p className="font-semibold text-gray-900 mt-3">{r.title}</p>}
              {r.body && <p className="text-sm text-gray-600 mt-1 leading-relaxed">{r.body}</p>}
              {(r as Review & { helpfulVotes?: number }).helpfulVotes != null &&
                (r as Review & { helpfulVotes?: number }).helpfulVotes! > 0 && (
                <p className="text-xs text-gray-400 mt-1.5">
                  👍 {(r as Review & { helpfulVotes?: number }).helpfulVotes} found helpful
                </p>
              )}

              {/* Owner response */}
              {r.ownerResponse && (
                <div className="mt-4 pl-4 border-l-2 bg-gray-50 rounded-r-lg py-3 pr-3" style={{ borderColor: '#BF5B2E' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#BF5B2E' }}>Your response:</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{r.ownerResponse}</p>
                </div>
              )}

              {/* Reply actions */}
              <div className="mt-4 flex gap-2">
                {!r.ownerResponse && replyingTo !== r.id && (
                  <button
                    onClick={() => { setReplyingTo(r.id); setReplyText(''); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                    style={{ color: '#BF5B2E', borderColor: '#BF5B2E' }}
                  >
                    Reply
                  </button>
                )}
                {r.ownerResponse && replyingTo !== r.id && (
                  <button
                    onClick={() => { setReplyingTo(r.id); setReplyText(r.ownerResponse ?? ''); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:border-gray-400 transition-colors"
                  >
                    Edit Reply
                  </button>
                )}
              </div>

              {/* Inline reply form */}
              {replyingTo === r.id && (
                <div className="mt-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={3}
                    placeholder="Write your response…"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleSubmitReply(r.id)}
                      disabled={submitting || !replyText.trim()}
                      className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
                      style={{ backgroundColor: '#BF5B2E' }}
                    >
                      {submitting ? 'Posting…' : 'Post Reply'}
                    </button>
                    <button
                      onClick={() => { setReplyingTo(null); setReplyText(''); }}
                      className="px-4 py-1.5 text-gray-600 text-xs font-semibold rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
