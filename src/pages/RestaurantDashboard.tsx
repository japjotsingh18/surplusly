import React, { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { format } from 'date-fns';
import { AlertTriangle, Loader2, LogOut, Plus, Clock, Tag, DollarSign, QrCode, X, MapPin } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';
import { db } from '../lib/firebase';
import { getAutomaticListingStatus, getEffectiveListingStatus } from '../lib/listings';
import { useAuth } from '../context/AuthContext';
import { Listing, ListingType, Reservation, RescueTask, RestaurantPickupLocation } from '../types';

const listingSchema = z.object({
  itemName: z.string().min(2, 'Item name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  dietaryTags: z.string().optional(),
  pickupBy: z.string().min(1, 'Pickup time is required'),
  listingType: z.enum(['discounted', 'donation'] as [ListingType, ...ListingType[]]),
  price: z.number().optional(),
  pickupLocationId: z.string().min(1, 'Pickup address is required'),
});

const pickupLocationSchema = z.object({
  label: z.string().min(2, 'Address name is required'),
  address: z.string().min(5, 'Street address is required'),
  city: z.string().min(1, 'City is required'),
});

const CITIES: Record<string, { lat: number; lng: number }> = {
  'Tempe, AZ': { lat: 33.4255, lng: -111.94 },
  'Phoenix, AZ': { lat: 33.4484, lng: -112.074 },
  'New York, NY': { lat: 40.7128, lng: -74.006 },
  'San Francisco, CA': { lat: 37.7749, lng: -122.4194 },
  'Austin, TX': { lat: 30.2672, lng: -97.7431 },
};

type ListingFormValues = z.infer<typeof listingSchema>;
type PickupLocationFormValues = z.infer<typeof pickupLocationSchema>;

type ReservationRecord = Reservation & {
  createdAt?: Date | null;
};

type RescueTaskRecord = RescueTask & {
  assignedAt?: Date | null;
};

type QrModalState = {
  kind: 'customer' | 'rescue' | 'standby' | 'error';
  title: string;
  description: string;
  code?: string;
  badgeLabel?: string;
  reservationId?: string;
  rescueTaskId?: string;
};

const mapReservation = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    pickupTime: snapshotDoc.data().pickupTime?.toDate?.() ?? snapshotDoc.data().pickupTime,
    createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
  }) as ReservationRecord;

const mapRescueTask = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    assignedAt: snapshotDoc.data().assignedAt?.toDate?.() ?? snapshotDoc.data().assignedAt ?? null,
  }) as RescueTaskRecord;

const mapPickupLocation = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
  }) as RestaurantPickupLocation;

const formatStatusLabel = (status: string) =>
  status.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

const RestaurantDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [pickupLocations, setPickupLocations] = useState<RestaurantPickupLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [qrModal, setQrModal] = useState<QrModalState | null>(null);
  const [isQrLoading, setIsQrLoading] = useState(false);
  const [isConfirmingPickup, setIsConfirmingPickup] = useState(false);
  const [rescueConfirmListing, setRescueConfirmListing] = useState<Listing | null>(null);
  const [isTriggeringRescue, setIsTriggeringRescue] = useState(false);
  const autoSyncingIds = useRef<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      listingType: 'discounted',
      quantity: 1,
      pickupLocationId: '',
    },
  });

  const {
    register: registerLocation,
    handleSubmit: handleLocationSubmit,
    reset: resetLocation,
    formState: { errors: locationErrors },
  } = useForm<PickupLocationFormValues>({
    resolver: zodResolver(pickupLocationSchema),
  });

  const listingType = watch('listingType');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'listings'), where('restaurantId', '==', user.id)),
      snapshot => {
        const fetchedListings = snapshot.docs
          .map(snapshotDoc => ({
            id: snapshotDoc.id,
            ...snapshotDoc.data(),
            pickupBy: snapshotDoc.data().pickupBy?.toDate?.() ?? snapshotDoc.data().pickupBy,
            createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
          }))
          .sort((a: any, b: any) => {
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return bTime - aTime;
          }) as Listing[];

        setLoadError(null);
        setListings(fetchedListings);
      },
      error => {
        console.error('Error fetching restaurant listings:', error);
        setLoadError(error.message || 'Failed to load your listings.');
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'restaurant_locations'), where('restaurantId', '==', user.id)),
      snapshot => {
        const fetchedLocations = snapshot.docs
          .map(mapPickupLocation)
          .sort((a, b) => {
            const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
            const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
            return aTime - bTime;
          });

        setPickupLocations(fetchedLocations);
        setLocationError(null);

        if (fetchedLocations.length > 0) {
          const currentLocationId = getValues('pickupLocationId');
          setValue(
            'pickupLocationId',
            fetchedLocations.some(location => location.id === currentLocationId) ? currentLocationId : fetchedLocations[0].id
          );
        }
      },
      error => {
        console.error('Error fetching pickup locations:', error);
        setLocationError(error.message || 'Failed to load saved pickup addresses.');
      }
    );

    return () => unsubscribe();
  }, [getValues, setValue, user]);

  useEffect(() => {
    listings.forEach(listing => {
      const nextStatus = getAutomaticListingStatus(listing);

      if (nextStatus === listing.status || autoSyncingIds.current.has(listing.id)) {
        return;
      }

      autoSyncingIds.current.add(listing.id);
      updateDoc(doc(db, 'listings', listing.id), { status: nextStatus })
        .catch(error => {
          console.error('Error auto-syncing listing status:', error);
        })
        .finally(() => {
          autoSyncingIds.current.delete(listing.id);
        });
    });
  }, [listings]);

  const onSubmit = async (data: ListingFormValues) => {
    if (!user) return;

    const selectedLocation = pickupLocations.find(location => location.id === data.pickupLocationId);
    if (!selectedLocation) {
      setLoadError('Add or select a saved pickup address before posting surplus.');
      return;
    }

    setIsLoading(true);

    try {
      await addDoc(collection(db, 'listings'), {
        restaurantId: user.id,
        restaurantName: user.name,
        itemName: data.itemName,
        quantity: data.quantity,
        dietaryTags: data.dietaryTags ? data.dietaryTags.split(',').map(tag => tag.trim()) : [],
        pickupBy: new Date(data.pickupBy),
        listingType: data.listingType,
        price: data.price || 0,
        status: 'live',
        pickupLocationId: selectedLocation.id,
        location: {
          address: selectedLocation.address,
          coordinates: selectedLocation.coordinates,
        },
        createdAt: serverTimestamp(),
      });
      reset();
      setValue('pickupLocationId', selectedLocation.id);
      setShowForm(false);
    } catch (error) {
      console.error('Error adding listing:', error);
      alert('Failed to add listing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSavePickupLocation = async (data: PickupLocationFormValues) => {
    if (!user) return;

    setIsSavingLocation(true);
    const baseCoords = CITIES[data.city] || CITIES['Tempe, AZ'];
    const fullAddress = `${data.address}, ${data.city}`;

    try {
      const locationRef = await addDoc(collection(db, 'restaurant_locations'), {
        restaurantId: user.id,
        label: data.label,
        address: fullAddress,
        city: data.city,
        coordinates: {
          latitude: baseCoords.lat + (Math.random() - 0.5) * 0.01,
          longitude: baseCoords.lng + (Math.random() - 0.5) * 0.01,
        },
        createdAt: serverTimestamp(),
      });

      setValue('pickupLocationId', locationRef.id);
      resetLocation();
      setShowAddressForm(false);
    } catch (error: any) {
      console.error('Error saving pickup location:', error);
      setLocationError(error?.message || 'Failed to save pickup address.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleTriggerRescue = async () => {
    if (!rescueConfirmListing) return;

    setIsTriggeringRescue(true);
    try {
      await updateDoc(doc(db, 'listings', rescueConfirmListing.id), {
        status: 'rescue_mode',
      });
      setRescueConfirmListing(null);
    } catch (error) {
      console.error('Error updating status:', error);
    } finally {
      setIsTriggeringRescue(false);
    }
  };

  const handleOpenQrCode = async (listing: Listing) => {
    setSelectedListing(listing);
    setIsQrLoading(true);
    setQrModal(null);

    try {
      const reservationSnapshot = await getDocs(
        query(collection(db, 'reservations'), where('listingId', '==', listing.id))
      );

      const reservationDocs = reservationSnapshot.docs.map(mapReservation);
      const activeReservation =
        reservationDocs.find(reservation => reservation.status === 'active') ?? reservationDocs[0];

      if (activeReservation?.qrCode) {
        setQrModal({
          kind: 'customer',
          title: 'Customer Pickup QR',
          description:
            'Use this code to verify the customer at pickup, then confirm the handoff to close the reservation cleanly.',
          code: activeReservation.qrCode,
          badgeLabel: 'Reserved Pickup',
          reservationId: activeReservation.id,
        });
        return;
      }

      const rescueSnapshot = await getDocs(
        query(collection(db, 'rescue_tasks'), where('listingId', '==', listing.id))
      );

      const rescueDocs = rescueSnapshot.docs.map(mapRescueTask);
      const activeRescueTask =
        rescueDocs.find(task => ['accepted', 'picked_up', 'delivered'].includes(task.status)) ?? rescueDocs[0];

      if (activeRescueTask) {
        setQrModal({
          kind: 'rescue',
          title: 'Volunteer Rescue QR',
          description:
            activeRescueTask.status === 'accepted'
              ? 'The volunteer can show this pickup QR at the restaurant before taking the donation.'
              : 'This rescue handoff is already in progress. Keep this QR available if you need to verify the volunteer again.',
          code: activeRescueTask.pickupQr || `pickup-${listing.id}`,
          badgeLabel: formatStatusLabel(activeRescueTask.status),
          rescueTaskId: activeRescueTask.id,
        });
        return;
      }

      const displayStatus = getEffectiveListingStatus(listing);
      setQrModal({
        kind: 'standby',
        title: 'No Active Pickup Yet',
        description:
          displayStatus === 'expired'
            ? 'This listing is already outside its pickup window, so there is no active handoff code to show.'
            : displayStatus === 'rescue_mode'
              ? 'This listing is waiting for a volunteer to accept the rescue. Once that happens, the volunteer pickup QR will appear here.'
              : 'This listing does not have a customer reservation or rescue assignment yet. Once someone claims it, their handoff QR will appear here.',
        badgeLabel: formatStatusLabel(displayStatus),
      });
    } catch (error: any) {
      console.error('Error loading handoff QR:', error);
      setQrModal({
        kind: 'error',
        title: 'Unable to Load QR Code',
        description: error?.message || 'There was a problem loading the active handoff code for this listing.',
      });
    } finally {
      setIsQrLoading(false);
    }
  };

  const handleConfirmCustomerPickup = async () => {
    if (!selectedListing || !qrModal?.reservationId) return;

    setIsConfirmingPickup(true);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'reservations', qrModal.reservationId), { status: 'completed' });
      batch.update(doc(db, 'listings', selectedListing.id), { status: 'completed' });
      await batch.commit();

      setSelectedListing(null);
      setQrModal(null);
    } catch (error: any) {
      console.error('Error confirming customer pickup:', error);
      alert(error?.message || 'Failed to confirm the pickup handoff.');
    } finally {
      setIsConfirmingPickup(false);
    }
  };

  const closeQrModal = () => {
    setSelectedListing(null);
    setQrModal(null);
    setIsQrLoading(false);
    setIsConfirmingPickup(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-bold text-gray-900">Restaurant Dashboard</h1>
              <button onClick={() => logout()} className="text-gray-500 hover:text-red-500 transition" title="Logout">
                <LogOut size={20} />
              </button>
            </div>
            <p className="text-gray-600">Welcome back, {user?.name}</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setShowAddressForm(!showAddressForm)}
              className="flex items-center gap-2 rounded-lg border border-green-200 bg-white px-4 py-2 font-semibold text-green-700 transition hover:bg-green-50"
            >
              <MapPin size={20} /> Add Pickup Address
            </button>
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition"
            >
              <Plus size={20} /> Post Surplus
            </button>
          </div>
        </header>

        <section className="mb-8 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Saved Pickup Addresses</h2>
              <p className="text-sm text-gray-600">Add your restaurant pickup locations once, then reuse them for every surplus post.</p>
            </div>
            {pickupLocations.length > 0 && (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                {pickupLocations.length} saved
              </span>
            )}
          </div>

          {locationError && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{locationError}</div>}

          {pickupLocations.length === 0 ? (
            <button
              onClick={() => setShowAddressForm(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm font-semibold text-gray-600 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
            >
              <MapPin size={18} />
              Add your first pickup address
            </button>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {pickupLocations.map(location => (
                <div key={location.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-green-100 p-2 text-green-700">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{location.label}</p>
                      <p className="mt-1 text-sm leading-5 text-gray-600">{location.address}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {showAddressForm && (
          <div className="mb-8 rounded-xl border border-green-100 bg-white p-6 shadow-md">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Add Pickup Address</h2>
                <p className="mt-1 text-sm text-gray-600">This address will appear in the pickup-location dropdown when posting surplus.</p>
              </div>
              <button
                onClick={() => setShowAddressForm(false)}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close address form"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLocationSubmit(handleSavePickupLocation)} className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address Name</label>
                <input {...registerLocation('label')} className="w-full rounded-md border p-2" placeholder="Main counter" />
                {locationErrors.label && <p className="text-red-500 text-sm">{locationErrors.label.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                <input {...registerLocation('address')} className="w-full rounded-md border p-2" placeholder="1100 E Apache Blvd" />
                {locationErrors.address && <p className="text-red-500 text-sm">{locationErrors.address.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <select {...registerLocation('city')} className="w-full rounded-md border p-2">
                  <option value="">Select City</option>
                  {Object.keys(CITIES).map(city => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
                {locationErrors.city && <p className="text-red-500 text-sm">{locationErrors.city.message}</p>}
              </div>

              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddressForm(false)} className="rounded-md border px-4 py-2 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLocation}
                  className="flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 font-semibold text-white transition hover:bg-green-700 disabled:opacity-70"
                >
                  {isSavingLocation && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save Address
                </button>
              </div>
            </form>
          </div>
        )}

        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8 animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold mb-4">Post New Surplus Listing</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Name</label>
                <input {...register('itemName')} className="w-full border rounded-md p-2" placeholder="e.g. Assorted Pastries" />
                {errors.itemName && <p className="text-red-500 text-sm">{errors.itemName.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" {...register('quantity', { valueAsNumber: true })} className="w-full border rounded-md p-2" />
                {errors.quantity && <p className="text-red-500 text-sm">{errors.quantity.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dietary Tags (comma separated)</label>
                <input {...register('dietaryTags')} className="w-full border rounded-md p-2" placeholder="vegan, gluten-free" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup By</label>
                <input type="datetime-local" {...register('pickupBy')} className="w-full border rounded-md p-2" />
                {errors.pickupBy && <p className="text-red-500 text-sm">{errors.pickupBy.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Address</label>
                <select {...register('pickupLocationId')} className="w-full border rounded-md p-2" disabled={pickupLocations.length === 0}>
                  <option value="">Select saved pickup address</option>
                  {pickupLocations.map(location => (
                    <option key={location.id} value={location.id}>
                      {location.label} - {location.address}
                    </option>
                  ))}
                </select>
                {pickupLocations.length === 0 && (
                  <p className="mt-1 text-sm text-amber-600">Add a pickup address before posting surplus.</p>
                )}
                {errors.pickupLocationId && <p className="text-red-500 text-sm">{errors.pickupLocationId.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
                <select {...register('listingType')} className="w-full border rounded-md p-2">
                  <option value="discounted">Discounted</option>
                  <option value="donation">Donation (Free)</option>
                </select>
              </div>

              {listingType === 'discounted' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price ($)</label>
                  <input type="number" step="0.01" {...register('price', { valueAsNumber: true })} className="w-full border rounded-md p-2" />
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading || pickupLocations.length === 0}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2 disabled:opacity-70"
                >
                  {isLoading && <Loader2 className="animate-spin h-4 w-4" />} Post Listing
                </button>
              </div>
            </form>
          </div>
        )}

        {loadError && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(listing => {
            const displayStatus = getEffectiveListingStatus(listing);

            return (
              <div key={listing.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="font-bold text-lg">{listing.itemName}</h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-bold ${
                      displayStatus === 'live'
                        ? 'bg-green-100 text-green-800'
                        : displayStatus === 'reserved'
                          ? 'bg-amber-100 text-amber-800'
                          : displayStatus === 'rescue_mode'
                            ? 'bg-orange-100 text-orange-700'
                            : displayStatus === 'completed'
                              ? 'bg-emerald-100 text-emerald-700'
                              : displayStatus === 'expired'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {formatStatusLabel(displayStatus)}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-2">
                    <Tag size={16} />
                    <span>{listing.quantity}x • {listing.dietaryTags.join(', ') || 'No tags'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>Pickup by: {format(listing.pickupBy, 'PP p')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} />
                    <span className="font-bold text-black">{listing.listingType === 'donation' ? 'FREE' : `$${listing.price}`}</span>
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-between items-center gap-3">
                  <button onClick={() => handleOpenQrCode(listing)} className="text-green-600 font-medium hover:underline">
                    View QR Code
                  </button>

                  {displayStatus === 'live' && (
                    <button
                      onClick={() => setRescueConfirmListing(listing)}
                      className="rounded-lg border border-orange-200 px-3 py-2 text-xs font-bold text-orange-600 transition hover:bg-orange-50 hover:text-orange-700"
                    >
                      Simulate Rescue Mode
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {listings.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No active listings. Post some surplus food!</p>
            </div>
          )}
        </div>
      </div>

      {selectedListing && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{isQrLoading ? 'Loading QR Code' : qrModal?.title || 'Pickup QR'}</h2>
                <p className="mt-1 text-sm text-gray-600">{selectedListing.itemName}</p>
              </div>
              <button onClick={closeQrModal} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700" aria-label="Close QR modal">
                <X size={18} />
              </button>
            </div>

            {isQrLoading ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 text-gray-600">
                <Loader2 className="h-8 w-8 animate-spin text-green-600" />
                <p className="text-sm">Fetching the current handoff QR for this listing...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {qrModal?.badgeLabel && (
                  <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-700">
                    {qrModal.badgeLabel}
                  </span>
                )}

                {qrModal?.code ? (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
                    <div className="mb-4 inline-flex rounded-full bg-green-100 p-3 text-green-700">
                      <QrCode size={28} />
                    </div>
                    <div className="inline-block rounded-xl bg-white p-4 shadow-sm">
                      <QRCodeCanvas value={qrModal.code} size={190} />
                    </div>
                    <p className="mt-4 break-all text-xs text-gray-400">{qrModal.code}</p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500">
                    <div className="mb-3 inline-flex rounded-full bg-gray-200 p-3 text-gray-600">
                      <QrCode size={28} />
                    </div>
                    <p className="text-sm">No scannable pickup token is available yet.</p>
                  </div>
                )}

                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">{qrModal?.description}</div>

                {qrModal?.kind === 'customer' && qrModal.reservationId && (
                  <button
                    onClick={handleConfirmCustomerPickup}
                    disabled={isConfirmingPickup}
                    className="w-full rounded-xl bg-green-600 py-3 font-bold text-white transition hover:bg-green-700 disabled:opacity-70"
                  >
                    {isConfirmingPickup ? 'Confirming Pickup...' : 'Confirm Customer Pickup'}
                  </button>
                )}

                <button onClick={closeQrModal} className="w-full rounded-xl bg-gray-900 py-3 font-bold text-white transition hover:bg-gray-800">
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {rescueConfirmListing && (
        <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-700">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-orange-600">Rescue simulation</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">Move to Rescue Mode?</h2>
                </div>
              </div>
              <button
                onClick={() => setRescueConfirmListing(null)}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close rescue confirmation"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <p className="font-semibold text-gray-900">{rescueConfirmListing.itemName}</p>
              <p className="mt-1 text-sm text-gray-600">
                This will make the listing visible to volunteers as an urgent rescue task.
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setRescueConfirmListing(null)}
                className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTriggerRescue}
                disabled={isTriggeringRescue}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-70"
              >
                {isTriggeringRescue && <Loader2 className="h-4 w-4 animate-spin" />}
                {isTriggeringRescue ? 'Moving...' : 'Move to Rescue Mode'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantDashboard;
