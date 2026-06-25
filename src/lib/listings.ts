import { Listing, ListingStatus } from '../types';

export const RESCUE_TRIGGER_MINUTES = 30;

export function toDate(value: Date | string | null | undefined) {
  if (value instanceof Date) {
    return value;
  }

  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getRescueTriggerAt(listing: Listing) {
  const pickupAt = toDate(listing.pickupBy);
  if (!pickupAt) {
    return null;
  }

  return new Date(pickupAt.getTime() - RESCUE_TRIGGER_MINUTES * 60 * 1000);
}

export function getAutomaticListingStatus(listing: Listing, now = new Date()): ListingStatus {
  const pickupAt = toDate(listing.pickupBy);
  if (!pickupAt) {
    return listing.status;
  }

  if (listing.status === 'completed' || listing.status === 'delivered' || listing.status === 'picked_up' || listing.status === 'assigned') {
    return listing.status;
  }

  if (pickupAt.getTime() <= now.getTime()) {
    if (listing.status === 'rescue_mode') {
      return 'expired';
    }

    if (listing.status === 'reserved') {
      return 'expired';
    }

    if (listing.status === 'live') {
      return 'expired';
    }
  }

  const rescueTriggerAt = getRescueTriggerAt(listing);
  if (listing.status === 'live' && rescueTriggerAt && rescueTriggerAt.getTime() <= now.getTime()) {
    return 'rescue_mode';
  }

  return listing.status;
}

export function getEffectiveListingStatus(listing: Listing, now = new Date()): ListingStatus {
  return getAutomaticListingStatus(listing, now);
}
