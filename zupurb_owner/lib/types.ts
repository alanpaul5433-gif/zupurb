export interface OwnerDoc {
  uid: string;
  displayName: string;
  email: string;
  establishmentIds: string[];
  createdAt: unknown;
  invitedBy?: string;
}

export interface Establishment {
  id: string;
  name: string;
  description?: string;
  categories?: string[];
  address?: string;
  phone?: string;
  website?: string;
  overallScore?: number;
  reviewCount?: number;
  ownerUids?: string[];
  isVerifiedBusiness?: boolean;
  hours?: Record<string, { open: string; close: string; closed: boolean }>;
  photoUrls?: string[];
}

export interface Review {
  id: string;
  authorUid: string;
  authorName?: string;
  rawScore: number;
  title?: string;
  body?: string;
  createdAt: unknown;
  status: string;
  ownerResponse?: string;
  ownerRespondedAt?: unknown;
}

export interface Deal {
  id: string;
  title: string;
  description?: string;
  pointCost: number;
  originalValueCents: number;
  expiresAt?: unknown;
  isActive: boolean;
  redemptionsCount?: number;
}

export interface Reservation {
  id: string;
  estId: string;
  guestUid: string;
  guestDisplayName?: string;
  guestEmail?: string;
  partySize: number;
  scheduledAt: unknown;
  status: 'pending' | 'confirmed' | 'seated' | 'no_show' | 'cancelled';
  ownerNote?: string;
}
