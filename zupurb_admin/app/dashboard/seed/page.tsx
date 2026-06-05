'use client';

import { useState } from 'react';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const ESTABLISHMENTS = [
  { id: 'the-social-lounge', name: 'The Social Lounge', type: 'Bar & Lounge', area: 'Downtown', priceRange: '$$', score: 8.4, imageUrl: 'https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800', hasAlcohol: true, hasReservations: true, hasDeals: true, tags: ['Cocktails', 'Live Music', 'Rooftop'] },
  { id: 'lumiere', name: 'Lumière', type: 'Fine Dining', area: 'Midtown', priceRange: '$$$', score: 9.1, imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800', hasAlcohol: true, hasReservations: true, hasDeals: false, tags: ['French', 'Fine Dining', 'Wine'] },
  { id: 'oasis-cafe', name: 'Oasis Café', type: 'Café', area: 'Uptown', priceRange: '$', score: 7.8, imageUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800', hasAlcohol: false, hasReservations: false, hasDeals: true, tags: ['Coffee', 'Brunch', 'Vegan-friendly'] },
  { id: 'sky-lounge', name: 'Sky Lounge', type: 'Rooftop Bar', area: 'Downtown', priceRange: '$$$', score: 8.9, imageUrl: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800', hasAlcohol: true, hasReservations: true, hasDeals: false, tags: ['Rooftop', 'Views', 'Cocktails'] },
  { id: 'le-bistrot', name: 'Le Bistrot', type: 'French Bistro', area: 'Old Town', priceRange: '$$', score: 8.2, imageUrl: 'https://images.unsplash.com/photo-1424847651672-bf20a4b0982b?w=800', hasAlcohol: true, hasReservations: true, hasDeals: true, tags: ['French', 'Romantic', 'Wine'] },
  { id: 'green-garden', name: 'Green Garden', type: 'Vegetarian', area: 'Suburbs', priceRange: '$', score: 7.5, imageUrl: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800', hasAlcohol: false, hasReservations: false, hasDeals: true, tags: ['Vegan', 'Healthy', 'Organic'] },
  { id: 'havana-social-club', name: 'Havana Social Club', type: 'Latin Bar', area: 'East Side', priceRange: '$$', score: 8.6, imageUrl: 'https://images.unsplash.com/photo-1516997121675-4c2d1684aa3e?w=800', hasAlcohol: true, hasReservations: true, hasDeals: false, tags: ['Latin', 'Dancing', 'Cocktails'] },
  { id: 'the-glass-house', name: 'The Glass House', type: 'Modern Bar', area: 'Waterfront', priceRange: '$$', score: 8.3, imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800', hasAlcohol: true, hasReservations: false, hasDeals: true, tags: ['Cocktails', 'Views', 'Modern'] },
  { id: 'pacific-kitchen', name: 'Pacific Kitchen', type: 'Asian Fusion', area: 'Midtown', priceRange: '$$', score: 8.0, imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800', hasAlcohol: true, hasReservations: true, hasDeals: false, tags: ['Asian', 'Fusion', 'Sushi'] },
  { id: 'starbucks-roast', name: 'Starbucks Coffee Roast', type: 'Café', area: 'Various', priceRange: '$', score: 7.0, imageUrl: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=800', hasAlcohol: false, hasReservations: false, hasDeals: true, tags: ['Coffee', 'Quick Bites'] },
];

const REVIEWS = [
  { estId: 'the-social-lounge', authorName: 'Sarah M.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=44', score: 8.5, text: 'Amazing atmosphere and the cocktails are absolutely divine. The rooftop view at sunset is something else entirely.', verificationTier: 'verified', helpfulVotes: 24 },
  { estId: 'lumiere', authorName: 'Marcus T.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=68', score: 9.2, text: 'Best fine dining experience I\'ve had in the city. The tasting menu is worth every penny.', verificationTier: 'verified', helpfulVotes: 31 },
  { estId: 'oasis-cafe', authorName: 'Alex K.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=47', score: 7.9, text: 'Perfect for a quiet work morning. Great coffee and the avocado toast is a must-try.', verificationTier: 'standard', helpfulVotes: 12 },
  { estId: 'sky-lounge', authorName: 'Jordan P.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=32', score: 9.0, text: 'The view from the top floor is breathtaking. Service was attentive and the drinks were well-crafted.', verificationTier: 'verified', helpfulVotes: 18 },
  { estId: 'le-bistrot', authorName: 'Emma L.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=25', score: 8.3, text: 'Charming little bistro with authentic French flavours. The steak frites are incredible.', verificationTier: 'verified', helpfulVotes: 9 },
  { estId: 'green-garden', authorName: 'Ryan H.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=60', score: 7.6, text: 'Great plant-based options. Even as a meat-eater I was impressed by the creativity of the dishes.', verificationTier: 'standard', helpfulVotes: 7 },
  { estId: 'havana-social-club', authorName: 'Sofia R.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=5', score: 8.7, text: 'Incredible vibes on a Friday night. The live salsa music gets everyone on the dance floor.', verificationTier: 'verified', helpfulVotes: 22 },
  { estId: 'the-glass-house', authorName: 'David W.', authorPhotoUrl: 'https://i.pravatar.cc/150?img=57', score: 8.1, text: 'Stylish venue with great cocktails. The floor-to-ceiling windows make for a stunning setting.', verificationTier: 'standard', helpfulVotes: 14 },
];

const DEALS = [
  { id: 'free-appetiser', title: 'Free Appetiser with Any Main', estId: 'the-social-lounge', estName: 'The Social Lounge', discountLabel: 'Free starter', description: 'Order any main course and receive a complimentary appetiser.', isActive: true },
  { id: 'cocktail-discount', title: '30% Off Cocktails — Happy Hour', estId: 'sky-lounge', estName: 'Sky Lounge', discountLabel: '30% off', discountPercent: 30, description: 'All cocktails 30% off between 5PM–7PM daily.', isActive: true },
  { id: 'free-dessert', title: 'Complimentary Dessert', estId: 'lumiere', estName: 'Lumière', discountLabel: 'Free dessert', description: 'Enjoy a complimentary dessert with any 3-course booking.', isActive: true },
  { id: 'brunch-deal', title: '2-for-1 Brunch', estId: 'oasis-cafe', estName: 'Oasis Café', discountLabel: '2-for-1', description: 'Two brunch plates for the price of one every weekend 9AM–12PM.', isActive: true },
  { id: 'green-garden-deal', title: '20% Off Entire Bill', estId: 'green-garden', estName: 'Green Garden', discountLabel: '20% off', discountPercent: 20, description: 'Get 20% off your entire bill when you dine in.', isActive: true },
];

interface SeedResult {
  label: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  count?: number;
  error?: string;
}

export default function SeedPage() {
  const [results, setResults] = useState<Record<string, SeedResult>>({
    establishments: { label: 'Establishments', status: 'idle' },
    reviews: { label: 'Reviews', status: 'idle' },
    deals: { label: 'Deals', status: 'idle' },
  });

  const update = (key: string, partial: Partial<SeedResult>) =>
    setResults((r) => ({ ...r, [key]: { ...r[key], ...partial } }));

  const seedEstablishments = async () => {
    update('establishments', { status: 'loading' });
    try {
      for (const est of ESTABLISHMENTS) {
        await setDoc(doc(db, 'establishments', est.id), {
          ...est,
          distanceKm: parseFloat((Math.random() * 3 + 0.2).toFixed(1)),
          openUntil: '11 PM',
          isActive: true,
          status: 'active',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        });
      }
      update('establishments', { status: 'done', count: ESTABLISHMENTS.length });
    } catch (e) {
      update('establishments', { status: 'error', error: String(e) });
    }
  };

  const seedReviews = async () => {
    update('reviews', { status: 'loading' });
    try {
      for (const rev of REVIEWS) {
        const ref = doc(collection(db, 'reviews'));
        await setDoc(ref, {
          id: ref.id,
          ...rev,
          authorUid: 'seed-author',
          status: 'published',
          aiSummary: '',
          createdAt: Timestamp.now(),
        });
        // Denormalized copy
        await setDoc(
          doc(db, `establishments/${rev.estId}/reviews/${ref.id}`),
          { id: ref.id, ...rev, status: 'published', createdAt: Timestamp.now() }
        );
      }
      update('reviews', { status: 'done', count: REVIEWS.length });
    } catch (e) {
      update('reviews', { status: 'error', error: String(e) });
    }
  };

  const seedDeals = async () => {
    update('deals', { status: 'loading' });
    try {
      for (const deal of DEALS) {
        await setDoc(doc(db, 'deals', deal.id), {
          ...deal,
          createdAt: Timestamp.now(),
        });
      }
      update('deals', { status: 'done', count: DEALS.length });
    } catch (e) {
      update('deals', { status: 'error', error: String(e) });
    }
  };

  const seedAll = async () => {
    await seedEstablishments();
    await seedReviews();
    await seedDeals();
  };

  const statusIcon = (s: SeedResult['status']) => {
    if (s === 'idle') return <span className="text-gray-300">○</span>;
    if (s === 'loading') return <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />;
    if (s === 'done') return <span className="text-green-500">✓</span>;
    return <span className="text-red-500">✕</span>;
  };

  const allDone = Object.values(results).every(r => r.status === 'done');
  const anyLoading = Object.values(results).some(r => r.status === 'loading');

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Seed Data</h1>
        <p className="text-sm text-gray-500 mt-1">Populate Firestore with realistic demo data for presentations.</p>
      </div>

      {/* Seed all button */}
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 mb-6 text-white">
        <h2 className="font-bold text-lg mb-1">Seed Everything</h2>
        <p className="text-orange-100 text-sm mb-4">
          {ESTABLISHMENTS.length} establishments · {REVIEWS.length} reviews · {DEALS.length} deals
        </p>
        <button
          onClick={seedAll}
          disabled={anyLoading || allDone}
          className="bg-white text-orange-600 font-bold text-sm px-6 py-2.5 rounded-lg hover:bg-orange-50 disabled:opacity-60 transition-colors"
        >
          {allDone ? '✓ All seeded!' : anyLoading ? 'Seeding…' : '🌱 Seed All'}
        </button>
      </div>

      {/* Individual seeders */}
      <div className="space-y-3">
        {[
          { key: 'establishments', fn: seedEstablishments, count: ESTABLISHMENTS.length, icon: '🏢', desc: 'Restaurants, bars, cafés, lounges' },
          { key: 'reviews', fn: seedReviews, count: REVIEWS.length, icon: '⭐', desc: 'Published reviews with scores' },
          { key: 'deals', fn: seedDeals, count: DEALS.length, icon: '🏷️', desc: 'Active deals and offers' },
        ].map(({ key, fn, count, icon, desc }) => {
          const result = results[key];
          return (
            <div key={key} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-5">{statusIcon(result.status)}</div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{icon} {result.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{desc} · {count} records</p>
                  {result.status === 'done' && (
                    <p className="text-xs text-green-600 mt-0.5">{result.count} records written</p>
                  )}
                  {result.status === 'error' && (
                    <p className="text-xs text-red-500 mt-0.5">{result.error}</p>
                  )}
                </div>
              </div>
              <button
                onClick={fn}
                disabled={result.status === 'loading' || result.status === 'done'}
                className="px-4 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition-colors"
              >
                {result.status === 'done' ? 'Done' : result.status === 'loading' ? '…' : 'Seed'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
        <p className="text-xs text-yellow-700 font-medium">⚠️ Re-seeding is safe — uses fixed document IDs so records are overwritten, not duplicated.</p>
      </div>
    </div>
  );
}
