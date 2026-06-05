'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface MetricCard {
  label: string;
  value: number | string;
  color: string;
}

interface DayData { day: string; reviews: number }
interface TypeData { type: string; count: number }
interface TierData { name: string; value: number }

const COLORS = ['#f97316', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7'];

function fmt(seconds: number): string {
  const d = new Date(seconds * 1000);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function last7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  return days;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [reviewsByDay, setReviewsByDay] = useState<DayData[]>([]);
  const [estByType, setEstByType] = useState<TypeData[]>([]);
  const [tierDist, setTierDist] = useState<TierData[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const [usersSnap, estSnap, reviewsSnap, dealsSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), limit(500))),
          getDocs(collection(db, 'establishments')),
          getDocs(query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(500))),
          getDocs(collection(db, 'deals')),
        ]);

        setMetrics([
          { label: 'Total Users', value: usersSnap.size, color: '#f97316' },
          { label: 'Total Establishments', value: estSnap.size, color: '#3b82f6' },
          { label: 'Total Reviews', value: reviewsSnap.size, color: '#22c55e' },
          { label: 'Active Deals', value: dealsSnap.docs.filter(d => d.data().isActive !== false).length, color: '#a855f7' },
        ]);

        // Reviews by day — last 7
        const days = last7Days();
        const dayCounts: Record<string, number> = {};
        days.forEach(d => { dayCounts[d] = 0; });
        reviewsSnap.docs.forEach((d) => {
          const data = d.data();
          if (data.createdAt?.seconds) {
            const label = fmt(data.createdAt.seconds);
            if (label in dayCounts) dayCounts[label]++;
          }
        });
        setReviewsByDay(days.map(d => ({ day: d, reviews: dayCounts[d] })));

        // Establishments by type
        const typeCounts: Record<string, number> = {};
        estSnap.docs.forEach((d) => {
          const t = d.data().type || 'Unknown';
          typeCounts[t] = (typeCounts[t] || 0) + 1;
        });
        setEstByType(Object.entries(typeCounts).map(([type, count]) => ({ type, count })));

        // User tier distribution
        const tierCounts: Record<string, number> = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
        usersSnap.docs.slice(0, 200).forEach((d) => {
          const tier = d.data().loyaltyTier || 'bronze';
          if (tier in tierCounts) tierCounts[tier]++;
          else tierCounts[tier] = 1;
        });
        setTierDist(Object.entries(tierCounts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value })));
      } catch {
        // silent — show empty state
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-64">
        <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview and trends</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{m.label}</p>
            <p className="text-3xl font-bold" style={{ color: m.color }}>{m.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Line chart — reviews per day */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Review Submissions (Last 7 Days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={reviewsByDay} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Line type="monotone" dataKey="reviews" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar chart — establishments by type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Establishments by Type</h2>
          {estByType.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-gray-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={estByType} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="type" tick={{ fontSize: 11, fill: '#9ca3af' }} />
                <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {estByType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Pie chart — user tier distribution */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-md">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">User Tier Distribution</h2>
        {tierDist.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-sm text-gray-400">No data yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={tierDist}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {tierDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
