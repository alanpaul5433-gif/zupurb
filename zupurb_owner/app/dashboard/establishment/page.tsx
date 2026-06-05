'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useOwnerAuth } from '@/lib/owner-auth-context';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

interface HoursRow {
  closed: boolean;
  open: string;
  close: string;
}

interface FormState {
  name: string;
  description: string;
  categories: string;
  phone: string;
  website: string;
  address: string;
  hours: Record<string, HoursRow>;
  photoUrls: string[];
}

const ALL_TAGS = [
  'Italian', 'Mexican', 'Japanese', 'Chinese', 'American', 'Mediterranean', 'Indian', 'Thai',
  'Bar', 'Café', 'Bakery', 'Nightlife', 'Club', 'Lounge', 'Fine Dining', 'Casual', 'Fast Casual',
  'Vegan Friendly', 'Vegetarian', 'Pet Friendly', 'Outdoor Seating', 'Rooftop', 'Live Music',
  'Sports Bar', 'Cocktail Bar', 'Wine Bar', 'Brunch', 'Late Night', 'Family Friendly',
];

const PRICE_RANGES = ['$', '$$', '$$$'] as const;
type PriceRange = '$' | '$$' | '$$$';

const defaultHours = (): Record<string, HoursRow> => {
  const h: Record<string, HoursRow> = {};
  DAY_KEYS.forEach((k) => { h[k] = { closed: false, open: '09:00', close: '22:00' }; });
  return h;
};

export default function EstablishmentPage() {
  const { establishmentIds } = useOwnerAuth();
  const [selectedEstId, setSelectedEstId] = useState<string>('');
  const [isVerified, setIsVerified] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    categories: '',
    phone: '',
    website: '',
    address: '',
    hours: defaultHours(),
    photoUrls: [],
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [priceRange, setPriceRange] = useState<PriceRange>('$$');
  const [hasAlcohol, setHasAlcohol] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [toastError, setToastError] = useState(false);

  const showToast = (msg: string, error = false) => {
    setToast(msg);
    setToastError(error);
    setTimeout(() => setToast(''), 3000);
  };

  useEffect(() => {
    if (establishmentIds.length > 0 && !selectedEstId) {
      setSelectedEstId(establishmentIds[0]);
    }
  }, [establishmentIds, selectedEstId]);

  useEffect(() => {
    if (!selectedEstId) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, 'establishments', selectedEstId), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setIsVerified(!!d.isVerifiedBusiness);
        setForm({
          name: d.name ?? '',
          description: d.description ?? '',
          categories: (d.categories ?? []).join(', '),
          phone: d.phone ?? '',
          website: d.website ?? '',
          address: d.address ?? '',
          hours: d.hours ?? defaultHours(),
          photoUrls: d.photoUrls ?? [],
        });
        setSelectedTags(d.tags ?? []);
        setPriceRange(d.priceRange ?? '$$');
        setHasAlcohol(d.hasAlcohol ?? false);
      }
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [selectedEstId]);

  const setHours = (key: string, field: keyof HoursRow, value: string | boolean) => {
    setForm((f) => ({
      ...f,
      hours: {
        ...f.hours,
        [key]: { ...f.hours[key], [field]: value },
      },
    }));
  };

  const addPhoto = () => {
    const url = newPhotoUrl.trim();
    if (!url) return;
    setForm((f) => ({ ...f, photoUrls: [...f.photoUrls, url] }));
    setNewPhotoUrl('');
  };

  const removePhoto = (index: number) => {
    setForm((f) => ({ ...f, photoUrls: f.photoUrls.filter((_, i) => i !== index) }));
  };

  const handleSave = async () => {
    if (!selectedEstId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'establishments', selectedEstId), {
        name: form.name,
        description: form.description,
        categories: form.categories.split(',').map((c) => c.trim()).filter(Boolean),
        phone: form.phone,
        website: form.website,
        address: form.address,
        hours: form.hours,
        photoUrls: form.photoUrls,
        tags: selectedTags,
        priceRange,
        hasAlcohol,
      });
      showToast('Changes saved successfully');
    } catch {
      showToast('Error saving changes', true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl">
      {toast && (
        <div
          className="fixed top-4 right-4 bg-white border-2 text-sm px-4 py-2.5 rounded-lg shadow-lg z-50"
          style={{ borderColor: toastError ? '#EF4444' : '#BF5B2E', color: toastError ? '#EF4444' : '#BF5B2E' }}
        >
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">My Establishment</h1>
          {isVerified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              Verified Business ✓
            </span>
          )}
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

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#BF5B2E', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Basic Info */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  placeholder="Restaurant name"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 resize-none"
                  placeholder="Describe your restaurant…"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Categories (comma-separated)</label>
                <input
                  value={form.categories}
                  onChange={(e) => setForm((f) => ({ ...f, categories: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  placeholder="e.g. Italian, Pizza, Fine Dining"
                />
              </div>
            </div>
          </section>

          {/* Contact */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Contact</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  placeholder="+1 555 000 0000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Website</label>
                <input
                  value={form.website}
                  onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  placeholder="https://yourrestaurant.com"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                <input
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                  placeholder="123 Main St, City, State"
                />
              </div>
            </div>
          </section>

          {/* Hours */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Hours</h2>
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-3 mb-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Day</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Close</p>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Closed</p>
              </div>
              {DAYS.map((day, i) => {
                const key = DAY_KEYS[i];
                const row = form.hours[key] ?? { closed: false, open: '09:00', close: '22:00' };
                return (
                  <div key={key} className="grid grid-cols-4 gap-3 items-center">
                    <p className="text-sm text-gray-700 font-medium">{day}</p>
                    <input
                      type="time"
                      value={row.open}
                      disabled={row.closed}
                      onChange={(e) => setHours(key, 'open', e.target.value)}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 disabled:opacity-40 disabled:bg-gray-50"
                    />
                    <input
                      type="time"
                      value={row.close}
                      disabled={row.closed}
                      onChange={(e) => setHours(key, 'close', e.target.value)}
                      className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 disabled:opacity-40 disabled:bg-gray-50"
                    />
                    <input
                      type="checkbox"
                      checked={row.closed}
                      onChange={(e) => setHours(key, 'closed', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          {/* Tags */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Tags</h2>
            <div className="flex flex-wrap gap-2">
              {ALL_TAGS.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setSelectedTags((prev) =>
                        active ? prev.filter((t) => t !== tag) : [...prev, tag]
                      )
                    }
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      active
                        ? 'bg-orange-500 text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Price Range & Alcohol */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Venue Details</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Price Range</label>
                <div className="flex gap-2">
                  {PRICE_RANGES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriceRange(p)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        priceRange === p
                          ? 'text-white'
                          : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                      style={priceRange === p ? { backgroundColor: '#BF5B2E' } : {}}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-800">Serves Alcohol / Age-Restricted Venue</p>
                  <p className="text-xs text-gray-500 mt-0.5">Enables age-gate prompt for consumers under 21</p>
                </div>
                <button
                  type="button"
                  onClick={() => setHasAlcohol((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-6 ${
                    hasAlcohol ? 'bg-orange-500' : 'bg-gray-200'
                  }`}
                  style={hasAlcohol ? { backgroundColor: '#BF5B2E' } : {}}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      hasAlcohol ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Photos</h2>
            {form.photoUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                {form.photoUrls.map((url, i) => (
                  <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-gray-200">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center font-bold"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={newPhotoUrl}
                onChange={(e) => setNewPhotoUrl(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPhoto(); } }}
              />
              <button
                onClick={addPhoto}
                className="px-4 py-2 text-white text-sm font-semibold rounded-lg transition-colors"
                style={{ backgroundColor: '#BF5B2E' }}
              >
                Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">Enter a public image URL and press Add or Enter.</p>
          </section>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2.5 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-60"
              style={{ backgroundColor: '#BF5B2E' }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
