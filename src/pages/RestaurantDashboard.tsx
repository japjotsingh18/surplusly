import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { addDoc, collection, query, where, onSnapshot, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Listing, ListingType } from '../types';
import { Plus, Clock, Tag, DollarSign, Loader2, LogOut, MapPin } from 'lucide-react';
import { format } from 'date-fns';

const listingSchema = z.object({
  itemName: z.string().min(2, 'Item name is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  description: z.string().optional(),
  dietaryTags: z.string().optional(),
  pickupBy: z.string().min(1, 'Pickup time is required'),
  listingType: z.enum(['discounted', 'donation'] as [ListingType, ...ListingType[]]),
  price: z.number().optional(),
  streetAddress: z.string().min(3, 'Street address is required'),
  photoUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
});

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (e) {
    console.error('Geocoding failed:', e);
  }
  return null;
}

type ListingFormValues = z.infer<typeof listingSchema>;

const RestaurantDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<'idle' | 'loading' | 'found' | 'failed'>('idle');

  const { register, handleSubmit, watch, reset, unregister, formState: { errors } } = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    defaultValues: {
      listingType: 'discounted',
      quantity: 1,
    }
  });

  const listingType = watch('listingType');

  useEffect(() => {
    if (listingType === 'donation') {
      unregister('price');
    }
  }, [listingType, unregister]);

  // Fetch listings
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'listings'),
      where('restaurantId', '==', user.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedListings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        pickupBy: doc.data().pickupBy.toDate(), // Convert Firestore Timestamp to JS Date
        createdAt: doc.data().createdAt?.toDate(),
      })) as Listing[];
      fetchedListings.sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
      setListings(fetchedListings);
    });

    return () => unsubscribe();
  }, [user]);

  const onSubmit = async (data: ListingFormValues) => {
    if (!user) { alert('Not logged in'); return; }
    setIsLoading(true);
    setGeocodeStatus('loading');

    let lat: number;
    let lng: number;

    const coords = await geocodeAddress(data.streetAddress);
    if (coords) {
      lat = coords.lat;
      lng = coords.lng;
      setGeocodeStatus('found');
    } else {
      setGeocodeStatus('failed');
      alert('Could not find that address on the map. Please double-check the address and try again.');
      setIsLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, 'listings'), {
        restaurantId: user.id,
        restaurantName: user.name,
        itemName: data.itemName,
        quantity: data.quantity,
        description: data.description || '',
        dietaryTags: data.dietaryTags ? data.dietaryTags.split(',').map(tag => tag.trim()) : [],
        pickupBy: new Date(data.pickupBy),
        listingType: data.listingType,
        price: data.price || 0,
        photoUrl: data.photoUrl || '',
        status: 'live',
        location: {
          address: data.streetAddress,
          coordinates: { latitude: lat, longitude: lng }
        },
        createdAt: serverTimestamp(),
      });
      reset();
      setGeocodeStatus('idle');
      setShowForm(false);
    } catch (error) {
      console.error('Error adding listing:', error);
      alert('Failed to add listing');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerRescue = async (listingId: string) => {
    if (!confirm('Simulate timeout: Move this item to Rescue Mode?')) return;
    try {
      await updateDoc(doc(db, 'listings', listingId), {
        status: 'rescue_mode'
      });
    } catch (error) {
      console.error("Error updating status:", error);
    }
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
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition"
          >
            <Plus size={20} /> Post Surplus
          </button>
        </header>

        {showForm && (
          <div className="bg-white p-6 rounded-xl shadow-md mb-8 animate-in slide-in-from-top-4 duration-300">
            <h2 className="text-xl font-bold mb-4">Post New Surplus Listing</h2>
            <form onSubmit={handleSubmit(onSubmit, (errs) => { console.error('Validation errors:', errs); alert('Form validation failed: ' + Object.keys(errs).join(', ')); })} className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                <textarea {...register('description')} className="w-full border rounded-md p-2" rows={2} placeholder="e.g. Fresh baked sourdough loaves from today, lightly toasted" />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14} /> Pickup Address</label>
                <input
                  {...register('streetAddress')}
                  className="w-full border rounded-md p-2"
                  placeholder="e.g. 1200 S Mill Ave, Tempe, AZ 85281"
                />
                {errors.streetAddress && <p className="text-red-500 text-sm">{errors.streetAddress.message}</p>}
                {geocodeStatus === 'loading' && <p className="text-blue-500 text-xs mt-1">Looking up address on map...</p>}
                {geocodeStatus === 'found' && <p className="text-green-600 text-xs mt-1">✓ Address found on map</p>}
                {geocodeStatus === 'failed' && <p className="text-red-500 text-xs mt-1">Address not found. Try being more specific.</p>}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo URL (optional)</label>
                <input {...register('photoUrl')} className="w-full border rounded-md p-2" placeholder="https://example.com/photo.jpg" />
                {errors.photoUrl && <p className="text-red-500 text-sm">{errors.photoUrl.message}</p>}
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
                  <input type="number" step="0.01" {...register('price', { setValueAs: (v) => v === '' ? undefined : parseFloat(v) })} className="w-full border rounded-md p-2" />
                </div>
              )}

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border rounded-md hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={isLoading} className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2">
                  {isLoading && <Loader2 className="animate-spin h-4 w-4" />} Post Listing
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(listing => (
            <div key={listing.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg">{listing.itemName}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                  listing.status === 'live' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                }`}>
                  {listing.status.toUpperCase()}
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
                  <span className="font-bold text-black">
                    {listing.listingType === 'donation' ? 'FREE' : `$${listing.price}`}
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                 <button className="text-green-600 font-medium hover:underline">View QR Code</button>
                 
                 {listing.status === 'live' && (
                   <button 
                     onClick={() => handleTriggerRescue(listing.id)}
                     className="text-orange-500 text-xs font-bold hover:text-orange-600 border border-orange-200 px-2 py-1 rounded"
                   >
                     Debug: Force Rescue
                   </button>
                 )}
              </div>
            </div>
          ))}

          {listings.length === 0 && !isLoading && (
            <div className="col-span-full text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <p className="text-gray-500">No active listings. Post some surplus food!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDashboard;
