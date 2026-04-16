export type UserRole = 'restaurant' | 'customer' | 'volunteer' | 'ngo';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  trustScore?: number;
  impactStats?: {
    mealsSaved: number;
    foodRescuedKg: number;
    co2Saved: number;
  };
  createdAt: Date;
}

export type ListingStatus = 'live' | 'rescue_mode' | 'assigned' | 'picked_up' | 'delivered' | 'expired';
export type ListingType = 'discounted' | 'donation';

export interface Listing {
  id: string;
  restaurantId: string;
  restaurantName?: string;
  itemName: string;
  quantity: number;
  dietaryTags: string[];
  pickupBy: Date;
  status: ListingStatus;
  listingType: ListingType;
  price?: number;
  originalPrice?: number;
  photoUrl?: string;
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  createdAt: Date;
}

export interface Reservation {
  id: string;
  listingId: string;
  customerId: string;
  qrCode: string;
  status: 'active' | 'completed' | 'cancelled' | 'expired';
  pickupTime: Date;
  createdAt: Date;
}

export interface RescueTask {
  id: string;
  listingId: string;
  volunteerId?: string;
  status: 'pending' | 'accepted' | 'picked_up' | 'delivered';
  assignedAt?: Date;
  pickupQr?: string;
  deliveryQr?: string;
}
