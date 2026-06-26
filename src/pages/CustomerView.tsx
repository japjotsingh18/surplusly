import React, { useEffect, useMemo, useState } from 'react';
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch } from 'firebase/firestore';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  Leaf,
  Loader2,
  LogIn,
  LogOut,
  MapPin,
  Navigation,
  QrCode,
  Search,
  Star,
  TimerReset,
  UtensilsCrossed,
  UserPlus,
  X,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { db } from '../lib/firebase';
import { getEffectiveListingStatus, toDate } from '../lib/listings';
import { useAuth } from '../context/AuthContext';
import { Listing, Reservation } from '../types';

type ReservationRecord = Reservation & {
  createdAt?: Date | null;
};

type SortOption = 'distance' | 'price' | 'closingSoon';
type ToggleFilter = 'vegan' | 'vegetarian' | 'pickupNow';

type TravelEstimate = {
  walking: string;
  driving: string;
};

type CustomerLocation = {
  label: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  source: 'current' | 'manual' | 'account';
};

const LOCATION_STORAGE_KEY = 'surplusly_customer_location';

const LOCATION_PRESETS: CustomerLocation[] = [
  {
    label: 'ASU Tempe',
    coordinates: { latitude: 33.4242, longitude: -111.9281 },
    source: 'manual',
  },
  {
    label: 'Downtown Tempe',
    coordinates: { latitude: 33.4255, longitude: -111.94 },
    source: 'manual',
  },
  {
    label: 'Phoenix',
    coordinates: { latitude: 33.4484, longitude: -112.074 },
    source: 'manual',
  },
];

const readStoredCustomerLocation = (): CustomerLocation | null => {
  try {
    const stored = window.localStorage.getItem(LOCATION_STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as CustomerLocation;
    if (!parsed?.coordinates?.latitude || !parsed?.coordinates?.longitude) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
};

type RestaurantGroup = {
  id: string;
  name: string;
  address: string;
  distanceMiles: number | null;
  travel: TravelEstimate;
  listingCount: number;
  openUntil: Date | null;
  cheapestPrice: number;
  closingSoonAt: Date | null;
  listings: Listing[];
  mapsUrl: string | null;
  rating: number;
  bestDiscount: number;
  hasVegan: boolean;
  hasVegetarian: boolean;
  pickupNow: boolean;
};

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: 'distance', label: 'Distance' },
  { key: 'price', label: 'Price' },
  { key: 'closingSoon', label: 'Closing Soon' },
];

const TOGGLE_FILTERS: { key: ToggleFilter; label: string }[] = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'pickupNow', label: 'Pickup Now' },
];

const mapListing = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    pickupBy: snapshotDoc.data().pickupBy?.toDate?.() ?? snapshotDoc.data().pickupBy,
    createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
  }) as Listing;

const mapReservation = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    pickupTime: snapshotDoc.data().pickupTime?.toDate?.() ?? snapshotDoc.data().pickupTime,
    createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
  }) as ReservationRecord;

const getReservationDisplayStatus = (reservation: ReservationRecord) => {
  if (reservation.status !== 'active') {
    return reservation.status;
  }

  const pickupAt = toDate(reservation.pickupTime);
  if (pickupAt && pickupAt.getTime() <= Date.now()) {
    return 'expired';
  }

  return 'active';
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const calculateDistanceMiles = (
  source?: { latitude: number; longitude: number } | null,
  target?: { latitude: number; longitude: number } | null
) => {
  if (!source || !target) {
    return null;
  }

  const earthRadiusMiles = 3958.8;
  const latDelta = toRadians(target.latitude - source.latitude);
  const lngDelta = toRadians(target.longitude - source.longitude);
  const a =
    Math.sin(latDelta / 2) * Math.sin(latDelta / 2) +
    Math.cos(toRadians(source.latitude)) *
      Math.cos(toRadians(target.latitude)) *
      Math.sin(lngDelta / 2) *
      Math.sin(lngDelta / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusMiles * c;
};

const formatDistance = (distanceMiles: number | null) => {
  if (distanceMiles === null) {
    return 'Set location for distance';
  }

  if (distanceMiles < 0.1) {
    return '<0.1 mi away';
  }

  return `${distanceMiles.toFixed(1)} mi away`;
};

const getTravelEstimate = (distanceMiles: number | null): TravelEstimate => {
  if (distanceMiles === null) {
    return {
      walking: 'Walking time unavailable',
      driving: 'Driving time unavailable',
    };
  }

  const walkingMinutes = Math.max(3, Math.round(distanceMiles * 20));
  const drivingMinutes = Math.max(2, Math.round(distanceMiles * 4));

  return {
    walking: `${walkingMinutes} min walk`,
    driving: `${drivingMinutes} min drive`,
  };
};

const getMinutesLeft = (pickupBy: Date) => {
  const pickupAt = toDate(pickupBy);
  if (!pickupAt) {
    return null;
  }

  return Math.max(0, Math.round((pickupAt.getTime() - Date.now()) / (1000 * 60)));
};

const formatTimeLeft = (pickupBy: Date) => {
  const minutes = getMinutesLeft(pickupBy);
  if (minutes === null) {
    return 'Pickup time unavailable';
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder > 0 ? `${hours} hr ${remainder} min left` : `${hours} hr left`;
  }

  return `${minutes} min left`;
};

const buildMapsUrl = (name?: string, address?: string) => {
  const queryValue = [name, address].filter(Boolean).join(', ');
  if (!queryValue) {
    return null;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryValue)}`;
};

const normalizeTag = (tag: string) => tag.trim().toLowerCase();

const hasDietaryTag = (listing: Listing, tag: 'vegan' | 'vegetarian') => {
  const tags = listing.dietaryTags.map(normalizeTag);
  if (tag === 'vegan') {
    return tags.includes('vegan');
  }

  return tags.includes('vegetarian') || tags.includes('veg') || tags.includes('vegan');
};

const getOriginalPrice = (listing: Listing) => {
  if (listing.listingType === 'donation') {
    return 0;
  }

  if (listing.originalPrice && listing.originalPrice > 0) {
    return listing.originalPrice;
  }

  const currentPrice = listing.price ?? 0;
  if (currentPrice <= 0) {
    return 12;
  }

  return Math.max(currentPrice + 6, Math.round(currentPrice / 0.4));
};

const getDiscountPercentage = (listing: Listing) => {
  if (listing.listingType === 'donation') {
    return 100;
  }

  const originalPrice = getOriginalPrice(listing);
  const currentPrice = listing.price ?? 0;
  if (originalPrice <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(((originalPrice - currentPrice) / originalPrice) * 100)));
};

const getDisplayPrice = (listing: Pick<Listing, 'listingType' | 'price'>) =>
  listing.listingType === 'donation' ? 'Free' : `$${listing.price ?? 0}`;

const getPickupWindowLabel = (pickupBy: Date | null) => {
  if (!pickupBy) {
    return 'Pickup time unavailable';
  }

  return `Pickup until ${format(pickupBy, 'h:mm a')}`;
};

const getPickupNow = (listing: Listing) => {
  const minutesLeft = getMinutesLeft(listing.pickupBy);
  return minutesLeft !== null && minutesLeft <= 45;
};

const getListingDescription = (listing: Listing) => {
  if (listing.dietaryTags.length > 0) {
    return `Tags: ${listing.dietaryTags.join(', ')}.`;
  }

  if (listing.listingType === 'donation') {
    return 'Free surplus meal ready for pickup before it goes to waste.';
  }

  return 'Fresh surplus food available for pickup today at a reduced price.';
};

const hashString = (value: string) =>
  Array.from(value).reduce((accumulator, character) => accumulator + character.charCodeAt(0), 0);

const getRestaurantRating = (value: string) => (4.2 + (hashString(value) % 8) * 0.1).toFixed(1);

const getRestaurantInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'SF';

const getBrandGradient = (seed: string) => {
  const palettes = [
    ['#22C55E', '#166534'],
    ['#F97316', '#EA580C'],
    ['#0EA5E9', '#2563EB'],
    ['#A855F7', '#7C3AED'],
    ['#F43F5E', '#E11D48'],
  ];

  return palettes[hashString(seed) % palettes.length];
};

const getRestaurantArtworkStyle = (seed: string) => {
  const [primary, secondary] = getBrandGradient(seed);
  return {
    backgroundImage: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.28), transparent 22%), radial-gradient(circle at 78% 28%, rgba(255,255,255,0.18), transparent 20%), linear-gradient(135deg, ${primary}, ${secondary})`,
  };
};

const getListingArtworkStyle = (seed: string) => {
  const [primary, secondary] = getBrandGradient(seed);
  return {
    backgroundImage: `radial-gradient(circle at 30% 25%, rgba(255,255,255,0.3), transparent 24%), radial-gradient(circle at 70% 72%, rgba(255,255,255,0.18), transparent 22%), linear-gradient(145deg, ${secondary}, ${primary})`,
  };
};

const CustomerView: React.FC = () => {
  const { user, firebaseUser, loading: authLoading, logout } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeReservations, setActiveReservations] = useState<ReservationRecord[]>([]);
  const [reservationModal, setReservationModal] = useState<ReservationRecord | null>(null);
  const [authPromptListing, setAuthPromptListing] = useState<Listing | null>(null);
  const [reserveError, setReserveError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('distance');
  const [activeFilters, setActiveFilters] = useState<Record<ToggleFilter, boolean>>({
    vegan: false,
    vegetarian: false,
    pickupNow: false,
  });
  const [customerLocation, setCustomerLocation] = useState<CustomerLocation | null>(() => readStoredCustomerLocation());
  const [isLocating, setIsLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isReservingId, setIsReservingId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'listings'),
      snapshot => {
        const availableListings = snapshot.docs
          .map(mapListing)
          .filter(listing => getEffectiveListingStatus(listing) === 'live')
          .sort((a, b) => (toDate(a.pickupBy)?.getTime() ?? 0) - (toDate(b.pickupBy)?.getTime() ?? 0));

        setListings(availableListings);
        setLoadError(null);
      },
      error => {
        console.error('Error loading listings:', error);
        setLoadError(error.message || 'Unable to load available food right now.');
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setActiveReservations([]);
      return;
    }

    const unsubscribe = onSnapshot(
      query(collection(db, 'reservations'), where('customerId', '==', user.id)),
      snapshot => {
        const reservations = snapshot.docs
          .map(mapReservation)
          .sort((a, b) => (toDate(b.createdAt ?? null)?.getTime() ?? 0) - (toDate(a.createdAt ?? null)?.getTime() ?? 0));

        setActiveReservations(reservations);
      },
      error => {
        console.error('Error loading reservations:', error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const liveListings = useMemo(
    () =>
      listings.filter(
        listing =>
          listing.location?.coordinates?.latitude !== 0 &&
          listing.location?.coordinates?.longitude !== 0
      ),
    [listings]
  );

  const userCoordinates = useMemo(() => {
    return customerLocation?.coordinates ?? null;
  }, [customerLocation]);

  const listingMatchesFilters = (listing: Listing) => {
    if (activeFilters.vegan && !hasDietaryTag(listing, 'vegan')) {
      return false;
    }

    if (activeFilters.vegetarian && !hasDietaryTag(listing, 'vegetarian')) {
      return false;
    }

    if (activeFilters.pickupNow && !getPickupNow(listing)) {
      return false;
    }

    return true;
  };

  const restaurantGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const groups = new Map<string, RestaurantGroup>();

    liveListings
      .filter(listingMatchesFilters)
      .forEach(listing => {
        const restaurantName = listing.restaurantName || 'Neighborhood Partner';
        const address = listing.location?.address || 'Address not provided';
        const searchHaystack = `${restaurantName} ${listing.itemName} ${(listing.dietaryTags || []).join(' ')}`.toLowerCase();

        if (normalizedSearch && !searchHaystack.includes(normalizedSearch)) {
          return;
        }

        const groupId = listing.restaurantId;
        const distanceMiles = calculateDistanceMiles(userCoordinates, listing.location?.coordinates);
        const existing = groups.get(groupId);
        const listingPickupBy = toDate(listing.pickupBy);
        const listingDiscount = getDiscountPercentage(listing);

        if (!existing) {
          groups.set(groupId, {
            id: groupId,
            name: restaurantName,
            address,
            distanceMiles,
            travel: getTravelEstimate(distanceMiles),
            listingCount: 1,
            openUntil: listingPickupBy,
            cheapestPrice: listing.listingType === 'donation' ? 0 : listing.price ?? 0,
            closingSoonAt: listingPickupBy,
            listings: [listing],
            mapsUrl: buildMapsUrl(restaurantName, address),
            rating: Number(getRestaurantRating(groupId)),
            bestDiscount: listingDiscount,
            hasVegan: hasDietaryTag(listing, 'vegan'),
            hasVegetarian: hasDietaryTag(listing, 'vegetarian'),
            pickupNow: getPickupNow(listing),
          });
          return;
        }

        existing.listingCount += 1;
        existing.listings.push(listing);

        if (existing.distanceMiles === null && distanceMiles !== null) {
          existing.distanceMiles = distanceMiles;
          existing.travel = getTravelEstimate(distanceMiles);
        }

        if (listingPickupBy && (!existing.openUntil || listingPickupBy.getTime() > existing.openUntil.getTime())) {
          existing.openUntil = listingPickupBy;
        }

        if (listingPickupBy && (!existing.closingSoonAt || listingPickupBy.getTime() < existing.closingSoonAt.getTime())) {
          existing.closingSoonAt = listingPickupBy;
        }

        const listingPrice = listing.listingType === 'donation' ? 0 : listing.price ?? 0;
        existing.cheapestPrice = Math.min(existing.cheapestPrice, listingPrice);
        existing.bestDiscount = Math.max(existing.bestDiscount, listingDiscount);
        existing.hasVegan = existing.hasVegan || hasDietaryTag(listing, 'vegan');
        existing.hasVegetarian = existing.hasVegetarian || hasDietaryTag(listing, 'vegetarian');
        existing.pickupNow = existing.pickupNow || getPickupNow(listing);
      });

    const groupsArray = Array.from(groups.values()).map(group => ({
      ...group,
      listings: [...group.listings].sort((a, b) => {
        const timeDelta = (toDate(a.pickupBy)?.getTime() ?? 0) - (toDate(b.pickupBy)?.getTime() ?? 0);
        if (timeDelta !== 0) {
          return timeDelta;
        }

        return (a.price ?? 0) - (b.price ?? 0);
      }),
    }));

    return groupsArray.sort((a, b) => {
      if (sortBy === 'price') {
        return a.cheapestPrice - b.cheapestPrice;
      }

      if (sortBy === 'closingSoon') {
        return (a.closingSoonAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.closingSoonAt?.getTime() ?? Number.MAX_SAFE_INTEGER);
      }

      return (a.distanceMiles ?? Number.MAX_SAFE_INTEGER) - (b.distanceMiles ?? Number.MAX_SAFE_INTEGER);
    });
  }, [activeFilters, liveListings, searchTerm, sortBy, userCoordinates]);

  const selectedRestaurant = useMemo(
    () => restaurantGroups.find(group => group.id === selectedRestaurantId) ?? null,
    [restaurantGroups, selectedRestaurantId]
  );

  useEffect(() => {
    if (selectedRestaurantId && !selectedRestaurant) {
      setSelectedRestaurantId(null);
    }
  }, [selectedRestaurant, selectedRestaurantId]);

  useEffect(() => {
    if (customerLocation || !user?.address?.coordinates) {
      return;
    }

    setCustomerLocation({
      label: 'Saved address',
      coordinates: user.address.coordinates,
      source: 'account',
    });
  }, [customerLocation, user]);

  useEffect(() => {
    if (!customerLocation) {
      window.localStorage.removeItem(LOCATION_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(customerLocation));
  }, [customerLocation]);

  const activePickupReservations = activeReservations.filter(
    reservation => getReservationDisplayStatus(reservation) === 'active'
  );

  const toggleFilter = (filter: ToggleFilter) => {
    setActiveFilters(current => ({
      ...current,
      [filter]: !current[filter],
    }));
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationNotice('Current location is not available in this browser. Choose a manual area instead.');
      return;
    }

    setIsLocating(true);
    setLocationNotice(null);
    navigator.geolocation.getCurrentPosition(
      position => {
        setCustomerLocation({
          label: 'Current location',
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          source: 'current',
        });
        setIsLocating(false);
      },
      () => {
        setCustomerLocation(null);
        setLocationNotice('Location access was blocked. Distances are hidden until you choose an area manually.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 * 60 * 5 }
    );
  };

  const handleSetManualLocation = (location: CustomerLocation) => {
    setCustomerLocation(location);
    setLocationNotice(null);
  };

  const handleReserve = async (listing: Listing) => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setAuthPromptListing(listing);
      return;
    }

    const existingReservation = activeReservations.find(
      reservation => reservation.listingId === listing.id && getReservationDisplayStatus(reservation) === 'active'
    );

    if (existingReservation) {
      setReservationModal(existingReservation);
      return;
    }

    setIsReservingId(listing.id);
    try {
      const reservationRef = doc(collection(db, 'reservations'));
      const batch = writeBatch(db);
      const qrCode = `${listing.id}-${user.id}-${Date.now()}`;

      const reservationData = {
        listingId: listing.id,
        customerId: user.id,
        qrCode,
        status: 'active' as const,
        pickupTime: listing.pickupBy,
        listingDetails: {
          itemName: listing.itemName,
          restaurantName: listing.restaurantName,
          listingType: listing.listingType,
          price: listing.price,
          address: listing.location?.address,
        },
        createdAt: serverTimestamp(),
      };

      batch.set(reservationRef, reservationData);
      batch.update(doc(db, 'listings', listing.id), {
        status: 'reserved',
      });
      await batch.commit();

      setReservationModal({
        id: reservationRef.id,
        listingId: listing.id,
        customerId: user.id,
        qrCode,
        status: 'active',
        pickupTime: listing.pickupBy,
        listingDetails: reservationData.listingDetails,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Error reserving:', error);
      setReserveError('We could not reserve this item right now. Please try again in a moment.');
    } finally {
      setIsReservingId(null);
    }
  };

  const reservationMapsUrl = buildMapsUrl(
    reservationModal?.listingDetails?.restaurantName,
    reservationModal?.listingDetails?.address
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <div className="mx-auto max-w-[1200px] px-4 pb-28 pt-4 sm:px-6 sm:pb-10 lg:px-8">
        <header className="pb-5 pt-2 sm:pb-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Surplusly</p>
              <h1 className="mt-2 text-[34px] font-black leading-tight tracking-tight text-slate-950 sm:text-[44px] md:text-[52px]">
                Find Surplus Food Near You
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Reserve discounted food from nearby restaurants before it goes to waste.
              </p>
            </div>

            {firebaseUser ? (
              <button
                onClick={() => logout()}
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                title="Logout"
              >
                <LogOut size={16} />
                Logout
              </button>
            ) : (
              <Link
                to="/auth/login"
                className="inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <LogIn size={16} />
                Sign in
              </Link>
            )}
          </div>
        </header>

        <div className="sticky top-0 z-30 -mx-4 border-b border-slate-200 bg-[#F8FAFC]/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="mx-auto max-w-[1200px]">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search restaurants or surplus food..."
                  className="w-full rounded-2xl bg-transparent px-11 py-3.5 text-sm outline-none ring-0 placeholder:text-slate-400"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SORT_OPTIONS.map(option => {
                const active = sortBy === option.key;
                return (
                  <button
                    key={option.key}
                    onClick={() => {
                      setSortBy(option.key);
                      if (option.key === 'distance' && !customerLocation) {
                        setLocationNotice('Add a location to sort restaurants by what is closest to you.');
                      }
                    }}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-[#22C55E] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}

              {TOGGLE_FILTERS.map(filter => {
                const active = activeFilters[filter.key];
                return (
                  <button
                    key={filter.key}
                    onClick={() => toggleFilter(filter.key)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-[#F97316] text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <MapPin className="mt-0.5 shrink-0 text-[#22C55E]" size={16} />
                  <div>
                    <p className="font-bold text-slate-800">
                      {customerLocation ? `Browsing near ${customerLocation.label}` : 'Add your location for real distances'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {customerLocation
                        ? 'Distances and nearby sorting use this location.'
                        : 'Use current location or choose an area manually.'}
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  <button
                    onClick={handleUseCurrentLocation}
                    disabled={isLocating}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:opacity-70"
                  >
                    {isLocating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Navigation size={14} />}
                    {isLocating ? 'Locating...' : 'Use current'}
                  </button>

                  {LOCATION_PRESETS.map(location => (
                    <button
                      key={location.label}
                      onClick={() => handleSetManualLocation(location)}
                      className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                        customerLocation?.label === location.label
                          ? 'border-green-300 bg-green-50 text-green-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {location.label}
                    </button>
                  ))}

                  {customerLocation && (
                    <button
                      onClick={() => {
                        setCustomerLocation(null);
                        setLocationNotice('Distances are hidden until you add a location again.');
                      }}
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {locationNotice && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                  {locationNotice}
                </p>
              )}
            </div>
          </div>
        </div>

        {activePickupReservations.length > 0 && (
          <section className="mt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Active Pickups</h2>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                {activePickupReservations.length} ready
              </span>
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {activePickupReservations.map(reservation => (
                <button
                  key={reservation.id}
                  onClick={() => setReservationModal(reservation)}
                  className="min-w-[240px] shrink-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-sm font-semibold text-slate-950">
                    {reservation.listingDetails?.itemName || 'Reserved Surplus'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {reservation.listingDetails?.restaurantName || 'Restaurant pickup'}
                  </p>
                  <div className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    QR ready
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {loadError && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </div>
        )}

        <div className="mt-5">
          {!selectedRestaurant ? (
            <section className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-slate-950">Browse Nearby Deals</h2>
                  <p className="mt-1 text-sm text-slate-600">Browse, view deals, reserve, and pick up before food goes to waste.</p>
                </div>
                <p className="text-sm font-medium text-slate-500">
                  {restaurantGroups.length} restaurant{restaurantGroups.length === 1 ? '' : 's'} found
                </p>
              </div>

              {restaurantGroups.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
                    <UtensilsCrossed size={28} />
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-950">No surplus food available right now</h3>
                  <p className="mt-2 text-sm text-slate-500">
                    Try another filter or check back closer to the next pickup window.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {restaurantGroups.map(group => (
                    <article
                      key={group.id}
                      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                    >
                      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4">
                        <div
                          className="relative flex h-[92px] w-[88px] items-end overflow-hidden rounded-2xl p-3 text-white sm:h-[104px] sm:w-24"
                          style={getRestaurantArtworkStyle(group.id)}
                        >
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.45))]" />
                          <div className="relative flex items-center gap-2">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-sm font-black backdrop-blur-sm">
                              {getRestaurantInitials(group.name)}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-[17px] font-bold text-slate-950">{group.name}</h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Star size={12} className="fill-[#F97316] text-[#F97316]" />
                                  {group.rating.toFixed(1)}
                                </span>
                                <span>{formatDistance(group.distanceMiles)}</span>
                                <span>{group.travel.walking}</span>
                                <span>{group.travel.driving}</span>
                              </div>
                            </div>

                            <div className="shrink-0 rounded-2xl bg-orange-50 px-3 py-2 text-center">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-orange-600">
                                {group.bestDiscount}% OFF
                              </p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                              {group.listingCount} surplus item{group.listingCount === 1 ? '' : 's'}
                            </span>
                            <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                              {getPickupWindowLabel(group.openUntil)}
                            </span>
                            <span className="truncate rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                              {group.address}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {group.hasVegan && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-lime-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-lime-700">
                                <Leaf size={12} />
                                Vegan
                              </span>
                            )}
                            {group.hasVegetarian && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
                                <Leaf size={12} />
                                Veg
                              </span>
                            )}
                            {group.pickupNow && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-700">
                                <TimerReset size={12} />
                                Pickup now
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-2 flex flex-col gap-2 pt-1 sm:col-span-1 sm:items-end sm:justify-center sm:pt-0">
                          <p className="text-sm font-semibold text-slate-900 sm:text-right">
                            Best price{' '}
                            <span className="text-[#22C55E]">{group.cheapestPrice === 0 ? 'Free' : `$${group.cheapestPrice}`}</span>
                          </p>
                          <button
                            onClick={() => setSelectedRestaurantId(group.id)}
                            className="inline-flex w-full items-center justify-center rounded-xl bg-[#22C55E] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 sm:w-auto"
                          >
                            View Deals
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <section className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <button
                  onClick={() => setSelectedRestaurantId(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>

                {selectedRestaurant.mapsUrl && (
                  <a
                    href={selectedRestaurant.mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <ExternalLink size={16} />
                    Open in Google Maps
                  </a>
                )}
              </div>

              <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
                <div
                  className="relative h-44 overflow-hidden sm:h-52"
                  style={getRestaurantArtworkStyle(`${selectedRestaurant.id}-banner`)}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(15,23,42,0.55))]" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-6">
                    <div className="flex flex-wrap items-end justify-between gap-4">
                      <div className="min-w-0">
                        <div className="mb-2 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
                          Restaurant details
                        </div>
                        <h2 className="break-words text-2xl font-black tracking-tight sm:text-3xl">{selectedRestaurant.name}</h2>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                            <Star size={13} className="fill-[#F97316] text-[#F97316]" />
                            {selectedRestaurant.rating.toFixed(1)}
                          </span>
                          <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                            {formatDistance(selectedRestaurant.distanceMiles)}
                          </span>
                          <span className="rounded-full bg-white/15 px-2.5 py-1 backdrop-blur-sm">
                            {getPickupWindowLabel(selectedRestaurant.openUntil)}
                          </span>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-white/15 px-4 py-3 text-left text-sm backdrop-blur-sm sm:text-right">
                        <p className="text-white/80">Best deal</p>
                        <p className="text-xl font-black text-white">{selectedRestaurant.bestDiscount}% OFF</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-4 text-sm text-slate-600 sm:px-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                    <MapPin size={14} />
                    {selectedRestaurant.address || 'Address not provided'}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                    <Navigation size={14} />
                    {selectedRestaurant.travel.walking}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5">
                    <Clock3 size={14} />
                    {selectedRestaurant.listingCount} live deal{selectedRestaurant.listingCount === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-3 px-4 py-4 sm:px-6 sm:py-5">
                  {selectedRestaurant.listings.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-orange-50 text-[#F97316]">
                        <UtensilsCrossed size={28} />
                      </div>
                      <h3 className="mt-4 text-lg font-bold text-slate-950">No surplus food available right now</h3>
                    </div>
                  ) : (
                    selectedRestaurant.listings.map(listing => {
                      const originalPrice = getOriginalPrice(listing);
                      const discount = getDiscountPercentage(listing);
                      const mapsUrl = buildMapsUrl(selectedRestaurant.name, selectedRestaurant.address);

                      return (
                        <article
                          key={listing.id}
                          className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                        >
                          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[112px_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-4">
                            <div
                              className="relative flex h-[112px] overflow-hidden rounded-2xl p-3 text-white"
                              style={getListingArtworkStyle(listing.id)}
                            >
                              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(15,23,42,0.4))]" />
                              <div className="relative mt-auto">
                                <div className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1 text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm">
                                  <UtensilsCrossed size={12} />
                                  Fresh deal
                                </div>
                              </div>
                            </div>

                            <div className="min-w-0">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                                <div className="min-w-0">
                                  <h3 className="break-words text-[17px] font-bold leading-tight text-slate-950">{listing.itemName}</h3>
                                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">{getListingDescription(listing)}</p>
                                </div>
                                <span className="w-fit shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-orange-600">
                                  {discount}% OFF
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                                {listing.listingType === 'donation' ? (
                                  <span className="font-bold text-[#22C55E]">Free today</span>
                                ) : (
                                  <>
                                    <span className="text-slate-400 line-through">${originalPrice}</span>
                                    <span className="font-bold text-[#22C55E]">Today {getDisplayPrice(listing)}</span>
                                  </>
                                )}
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                                  {listing.quantity} left
                                </span>
                                <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
                                  {formatTimeLeft(listing.pickupBy)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                                  Pickup by {toDate(listing.pickupBy) ? format(listing.pickupBy, 'h:mm a') : 'Pickup time unavailable'}
                                </span>
                              </div>
                            </div>

                            <div className="col-span-2 grid grid-cols-1 gap-2 pt-1 sm:col-span-1 sm:flex sm:flex-col sm:items-end sm:justify-center sm:pt-0">
                              {mapsUrl && (
                                <a
                                  href={mapsUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                >
                                  <ExternalLink size={15} />
                                  Maps
                                </a>
                              )}

                              <button
                                onClick={() => handleReserve(listing)}
                                disabled={authLoading || isReservingId === listing.id}
                                className="inline-flex w-full min-w-[138px] items-center justify-center rounded-xl bg-[#22C55E] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600 disabled:opacity-70 sm:w-auto"
                              >
                                {authLoading ? 'Checking...' : isReservingId === listing.id ? 'Reserving...' : 'Reserve Now'}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>

      {reservationModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[28px] bg-white p-5 text-center shadow-2xl sm:p-7">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-[#22C55E]">
              <QrCode size={32} />
            </div>
            <h2 className="text-2xl font-bold text-slate-950">Pickup QR Ready</h2>
            <p className="mt-2 text-slate-700">
              {reservationModal.listingDetails?.itemName || 'Your reserved surplus item'}
            </p>
            <p className="mb-6 mt-1 text-sm text-slate-500">
              {reservationModal.listingDetails?.restaurantName || 'Show this at the restaurant pickup counter.'}
            </p>

            <div className="mb-5 inline-block rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4">
              <QRCodeCanvas value={reservationModal.qrCode} size={180} />
            </div>

            <p className="mb-4 text-xs text-slate-400">Reservation ID: {reservationModal.id.slice(0, 8)}</p>

            <div className="space-y-3">
              {reservationMapsUrl && (
                <a
                  href={reservationMapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <ExternalLink size={16} />
                  Open in Google Maps
                </a>
              )}

              <button
                onClick={() => setReservationModal(null)}
                className="w-full rounded-xl bg-slate-950 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {authPromptListing && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white p-5 text-left shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
                  style={getListingArtworkStyle(authPromptListing.id)}
                >
                  <UtensilsCrossed size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#22C55E]">Reserve food</p>
                  <h2 className="mt-1 text-xl font-bold text-slate-950">Sign in to continue</h2>
                </div>
              </div>

              <button
                onClick={() => setAuthPromptListing(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-950">{authPromptListing.itemName}</p>
              <p className="mt-1 text-sm text-slate-500">
                {authPromptListing.restaurantName || 'Restaurant pickup'} - {getDisplayPrice(authPromptListing)}
              </p>
            </div>

            <p className="mt-5 text-sm leading-6 text-slate-600">
              Create or sign in to your customer account so Surplusly can hold this deal and generate your pickup QR.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                to="/auth/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#22C55E] px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
              >
                <LogIn size={16} />
                Sign in
              </Link>
              <Link
                to="/auth/signup"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                <UserPlus size={16} />
                Create account
              </Link>
            </div>

            <button
              onClick={() => setAuthPromptListing(null)}
              className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
            >
              Keep browsing
            </button>
          </div>
        </div>
      )}

      {reserveError && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-slate-950/55 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-[28px] bg-white p-5 text-left shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">Reservation issue</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">Could not reserve</h2>
              </div>
              <button
                onClick={() => setReserveError(null)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">{reserveError}</p>

            <button
              onClick={() => setReserveError(null)}
              className="mt-6 w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerView;
