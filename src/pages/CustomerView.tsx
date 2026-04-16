import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, Reservation } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';
import { Clock, MapPin, Tag, Search, Filter, QrCode, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { QRCodeCanvas } from 'qrcode.react';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet default icon issues
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Helper component to recenter map
const MapRecenter: React.FC<{ listings: Listing[] }> = ({ listings }) => {
  const map = useMap();
  useEffect(() => {
    console.log('MapRecenter triggered with listings:', listings.length);
    if (listings.length > 0) {
      const first = listings[0];
      console.log('First listing coords:', first.location?.coordinates);
      if (first.location?.coordinates?.latitude && first.location?.coordinates?.longitude) {
        console.log('Flying to:', first.location.coordinates);
        map.setView(
          [first.location.coordinates.latitude, first.location.coordinates.longitude], 
          13
        );
      }
    }
  }, [listings, map]);
  return null;
};

const CustomerView: React.FC = () => {
  const { user, logout } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch live listings
  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'live')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedListings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        pickupBy: doc.data().pickupBy.toDate(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Listing[];
      fetchedListings.sort((a, b) => a.pickupBy.getTime() - b.pickupBy.getTime());
      setListings(fetchedListings);
    });

    return () => unsubscribe();
  }, []);

  const handleReserve = async (listing: Listing) => {
    if (!user) {
      alert("Please login to reserve food.");
      return;
    }

    try {
      // 1. Create Reservation
      const reservationData = {
        listingId: listing.id,
        customerId: user.id,
        qrCode: `${listing.id}-${user.id}-${Date.now()}`, // Simple unique string for QR
        status: 'active',
        pickupTime: listing.pickupBy,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, 'reservations'), reservationData);
      
      // 2. Update Listing Status (Optimistic locking would be better in production)
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'reserved' // Note: You might want a 'reserved' status in your types
      });

      setReservation({ id: docRef.id, ...reservationData } as any);
      alert("Reservation successful! Show the QR code to the restaurant.");
    } catch (error) {
      console.error("Error reserving:", error);
      alert("Failed to reserve item.");
    }
  };

  const filteredListings = listings.filter(l => 
    (l.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.restaurantName?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    l.location?.coordinates?.latitude !== 0 // Filter out bad listings
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Sidebar / List View */}
      <div className={`w-full md:w-1/3 bg-white border-r border-gray-200 flex flex-col ${viewMode === 'map' ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-gray-100 z-10 bg-white shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-800">Find Food</h1>
            <button 
              onClick={() => logout()} 
              className="text-gray-500 hover:text-red-500 transition"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Search food or restaurants..." 
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 py-2 rounded-md font-medium text-sm ${viewMode === 'list' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
            >
              List View
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`flex-1 py-2 rounded-md font-medium text-sm md:hidden ${viewMode === 'map' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
            >
              Map View
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredListings.map(listing => (
            <div 
              key={listing.id} 
              className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition cursor-pointer bg-white"
              onClick={() => setSelectedListing(listing)}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-bold text-lg text-gray-900">{listing.itemName}</h3>
                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">
                  {listing.listingType === 'donation' ? 'FREE' : `$${listing.price}`}
                </span>
              </div>
              <p className="text-gray-600 text-sm mb-2">{listing.restaurantName}</p>
              
              <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                <div className="flex items-center gap-1">
                  <Clock size={14} />
                  <span>{format(listing.pickupBy, 'h:mm a')}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Tag size={14} />
                  <span>{listing.quantity} left</span>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleReserve(listing);
                }}
                className="w-full bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition"
              >
                Reserve
              </button>
            </div>
          ))}
          
          {filteredListings.length === 0 && (
            <div className="text-center py-10 text-gray-500">
              No food found nearby.
            </div>
          )}
        </div>
      </div>

      {/* Map View */}
      <div className={`flex-1 relative ${viewMode === 'list' ? 'hidden md:block' : 'block'}`}>
        <MapContainer center={[40.7128, -74.0060]} zoom={13} style={{ height: '100%', width: '100%' }}>
          <MapRecenter listings={filteredListings} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {filteredListings.map(listing => (
            <Marker 
              key={listing.id} 
              position={[listing.location?.coordinates?.latitude || 40.7128, listing.location?.coordinates?.longitude || -74.0060]}
              eventHandlers={{
                click: () => setSelectedListing(listing),
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold">{listing.itemName}</h3>
                  <p>{listing.restaurantName}</p>
                  <p className="font-bold text-green-600">
                    {listing.listingType === 'donation' ? 'FREE' : `$${listing.price}`}
                  </p>
                  <button 
                    onClick={() => handleReserve(listing)}
                    className="mt-2 bg-green-600 text-white px-4 py-1 rounded text-sm w-full"
                  >
                    Reserve
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        {/* Mobile toggle back to list */}
        <button 
          onClick={() => setViewMode('list')}
          className="absolute top-4 left-4 z-[1000] bg-white p-2 rounded-full shadow-lg md:hidden"
        >
          Back to List
        </button>
      </div>

      {/* Reservation Success Modal */}
      {reservation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[2000] p-4">
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <div className="mx-auto bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-green-600">
              <QrCode size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Reservation Confirmed!</h2>
            <p className="text-gray-600 mb-6">Show this code to the restaurant to pick up your food.</p>
            
            <div className="bg-white p-4 border-2 border-dashed border-gray-300 rounded-xl inline-block mb-6">
              <QRCodeCanvas value={reservation.qrCode} size={180} />
            </div>
            
            <p className="text-xs text-gray-400 mb-6">Order ID: {reservation.id.slice(0, 8)}</p>
            
            <button 
              onClick={() => setReservation(null)}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerView;
