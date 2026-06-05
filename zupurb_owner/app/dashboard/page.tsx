'use client';

import { useEffect, useState } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs, Timestamp,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';
import type { Establishment } from '@/lib/types';

interface DemographicSegment {
  segment: string;
  avgScore: number;
  reviewCount: number;
}

interface Analytics {
  followerCount: number;
  aiSummary: string | null;
  demographicScores: DemographicSegment[];
}

interface Stats {
  overallScore: number | null;
  reviewCount: number;
  thisMonthReviews: number;
  upcomingReservations: number;
}

export default function DashboardOverviewPage() {
  const { establishmentIds } = useOwnerAuth();
  const [selectedEstId, setSelectedEstId] = useState<string>('');
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [stats, setStats] = useState<Stats>({ overallScore: null, reviewCount: 0, thisMonthReviews: 0, upcomingReservations: 0 });
  const [analytics, setAnalytics] = useState<Analytics>({ followerCount: 0, aiSummary: null, demographicScores: [] });
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  // Set initial selected establishment
  useEffect(() => {
    if (establishmentIds.length > 0 && !selectedEstId) {
      setSelectedEstId(establishmentIds[0]);
    }
  }, [establishmentIds, selectedEstId]);

  // Load establishment data + stats when selection changes
  useEffect(() => {
    if (!selectedEstId) return;

    setLoading(true);

    const loadData = async () => {
      try {
        // Load establishment doc
        const estSnap = await getDoc(doc(db, 'establishments', selectedEstId));
        if (estSnap.exists()) {
          const estData = { id: estSnap.id, ...estSnap.data() } as Establishment;
          setEstablishment(estData);

          // This month reviews
          const now = new Date();
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          const reviewsQ = query(
            collection(db, 'establishments', selectedEstId, 'reviews'),
            where('createdAt', '>=', Timestamp.fromDate(monthStart)),
          );
          const reviewsSnap = await getDocs(reviewsQ);

          // Upcoming reservations
          const upcomingQ = query(
            collection(db, 'reservations'),
            where('estId', '==', selectedEstId),
            where('scheduledAt', '>=', Timestamp.now()),
            where('status', 'in', ['pending', 'confirmed']),
          );
          const upcomingSnap = await getDocs(upcomingQ);

          setStats({
            overallScore: estData.overallScore ?? null,
            reviewCount: estData.reviewCount ?? 0,
            thisMonthReviews: reviewsSnap.size,
            upcomingReservations: upcomingSnap.size,
          });
        }
      } catch {
        showToast('Error loading data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [selectedEstId]);

  // Fetch analytics (follower count, AI summary, demographic scores)
  useEffect(() => {
    if (!selectedEstId) return;
    const loadAnalytics = async () => {
      setAnalyticsLoading(true);
      try {
        const idToken = await getAuth().currentUser?.getIdToken();
        if (!idToken) return;
        const res = await fetch(
          `https://us-central1-zupurb-9580f.cloudfunctions.net/getOwnerAnalytics?estId=${selectedEstId}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setAnalytics({
            followerCount: data.followerCount ?? 0,
            aiSummary: data.aiSummary ?? null,
            demographicScores: data.demographicScores ?? [],
          });
        }
      } catch {
        // Non-critical; fail silently
      } finally {
        setAnalyticsLoading(false);
      }
    };
    loadAnalytics();
  }, [selectedEstId]);

  const statCards = [
    {
      label: 'Average Score',
      value: stats.overallScore != null ? stats.overallScore.toFixed(1) : '—',
      sub: 'Overall rating',
      color: '#BF5B2E',
    },
    {
      label: 'Total Reviews',
      value: stats.reviewCount.toString(),
      sub: 'All time',
      color: '#6366F1',
    },
    {
      label: 'This Month',
      value: stats.thisMonthReviews.toString(),
      sub: 'New reviews',
      color: '#10B981',
    },
    {
      label: 'Upcoming',
      value: stats.upcomingReservations.toString(),
      sub: 'Reservations',
      color: '#F59E0B',
    },
    {
      label: 'Followers',
      value: analytics.followerCount.toLocaleString(),
      sub: 'Total followers',
      icon: '👥',
      color: '#8B5CF6',
    },
  ];

  return (
    <div className="p-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-white border-2 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50" style={{ borderColor: '#BF5B2E', color: '#BF5B2E' }}>
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          {establishment && (
            <p className="text-sm text-gray-500 mt-1">{establishment.name}</p>
          )}
        </div>

        {establishmentIds.length > 1 && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Establishment</label>
            <select
              value={selectedEstId}
              onChange={(e) => setSelectedEstId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2"
            >
              {establishmentIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  {'icon' in card && card.icon ? (
                    <span className="text-base leading-none">{card.icon}</span>
                  ) : (
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.color }} />
                  )}
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
                </div>
                <p className="text-3xl font-bold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* AI Summary Panel */}
          <div className="bg-white rounded-xl border-2 p-6 mb-6 relative" style={{ borderColor: '#BF5B2E' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-800">AI Summary</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-200">
                ✨ AI-generated
              </span>
            </div>
            {analyticsLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
                <span className="text-sm text-gray-400">Loading summary…</span>
              </div>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed">
                {analytics.aiSummary ?? 'No AI summary available yet — accumulate more reviews to generate insights.'}
              </p>
            )}
          </div>

          {/* Customer Segments */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-sm font-bold text-gray-800 mb-4">Customer Segments</h2>
            {analyticsLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
                <span className="text-sm text-gray-400">Loading segments…</span>
              </div>
            ) : analytics.demographicScores.length === 0 ? (
              <p className="text-sm text-gray-400">Demographic data will appear as more verified reviews come in.</p>
            ) : (
              <div className="space-y-4">
                {analytics.demographicScores.map((seg) => (
                  <div key={seg.segment}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700">{seg.segment}</span>
                      <span className="text-xs text-gray-400">{seg.avgScore.toFixed(1)} avg · {seg.reviewCount} reviews</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${(seg.avgScore / 5) * 100}%`, backgroundColor: '#BF5B2E' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Establishment quick info */}
          {establishment && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-base font-bold text-gray-900">{establishment.name}</h2>
                {establishment.isVerifiedBusiness && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                    Verified Business ✓
                  </span>
                )}
              </div>
              {establishment.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-3">{establishment.description}</p>
              )}
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                {establishment.address && <span>📍 {establishment.address}</span>}
                {establishment.phone && <span>📞 {establishment.phone}</span>}
                {establishment.website && (
                  <a href={establishment.website} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: '#BF5B2E' }}>
                    {establishment.website}
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
