import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getEffectiveListingStatus, toDate } from '../lib/listings';
import { Listing, RescueTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapPin, Clock, Navigation, Package, QrCode, X } from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

type RescueTaskRecord = RescueTask & {
  assignedAt?: Date | null;
};

const mapListing = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    pickupBy: snapshotDoc.data().pickupBy?.toDate?.() ?? snapshotDoc.data().pickupBy,
    createdAt: snapshotDoc.data().createdAt?.toDate?.() ?? snapshotDoc.data().createdAt ?? null,
  }) as Listing;

const mapRescueTask = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    assignedAt: snapshotDoc.data().assignedAt?.toDate?.() ?? snapshotDoc.data().assignedAt ?? null,
  }) as RescueTaskRecord;

const VolunteerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [availableTasks, setAvailableTasks] = useState<Listing[]>([]);
  const [myTasks, setMyTasks] = useState<RescueTaskRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'my-tasks'>('available');
  const [qrModal, setQrModal] = useState<{ title: string; code: string; description: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'listings'), snapshot => {
      const tasks = snapshot.docs
        .map(mapListing)
        .filter(listing => getEffectiveListingStatus(listing) === 'rescue_mode')
        .sort((a, b) => (toDate(a.pickupBy)?.getTime() ?? 0) - (toDate(b.pickupBy)?.getTime() ?? 0));

      setAvailableTasks(tasks);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'rescue_tasks'), snapshot => {
      const tasks = snapshot.docs
        .map(mapRescueTask)
        .filter(task => task.volunteerId === user.id)
        .filter(task => ['accepted', 'picked_up'].includes(task.status))
        .sort((a, b) => (toDate(b.assignedAt ?? null)?.getTime() ?? 0) - (toDate(a.assignedAt ?? null)?.getTime() ?? 0));

      setMyTasks(tasks);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAcceptTask = async (listing: Listing) => {
    if (!user) return;

    try {
      const rescueTaskRef = doc(collection(db, 'rescue_tasks'));
      const batch = writeBatch(db);

      batch.set(rescueTaskRef, {
        listingId: listing.id,
        volunteerId: user.id,
        status: 'accepted',
        assignedAt: new Date(),
        pickupQr: `pickup-${listing.id}-${user.id}`,
        deliveryQr: `delivery-${listing.id}-${user.id}`,
        listingDetails: listing,
      });
      batch.update(doc(db, 'listings', listing.id), {
        status: 'assigned',
      });

      await batch.commit();
      alert('Task accepted! Head to the My Tasks tab.');
    } catch (error) {
      console.error('Error accepting task:', error);
      alert('Failed to accept task');
    }
  };

  const handleConfirmPickup = async (task: RescueTaskRecord) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'rescue_tasks', task.id), {
        status: 'picked_up',
      });
      batch.update(doc(db, 'listings', task.listingId), {
        status: 'picked_up',
      });
      await batch.commit();
      alert('Pickup confirmed. Head to the NGO drop-off and show the delivery QR there.');
    } catch (error) {
      console.error('Error updating pickup status:', error);
      alert('Failed to confirm pickup');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 pb-28 pt-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-black leading-tight tracking-tight text-gray-950 sm:text-4xl">Volunteer Dashboard</h1>
          <p className="mt-2 text-base text-gray-600 sm:text-lg">Thank you for being a food rescue hero!</p>
        </header>

        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4">
          <button
            onClick={() => setActiveTab('available')}
            className={`shrink-0 px-4 pb-3 text-sm font-bold sm:text-base ${activeTab === 'available' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
          >
            Available Tasks
          </button>
          <button
            onClick={() => setActiveTab('my-tasks')}
            className={`shrink-0 px-4 pb-3 text-sm font-bold sm:text-base ${activeTab === 'my-tasks' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
          >
            My Active Rescues
          </button>
        </div>

        {activeTab === 'available' && (
          <div className="space-y-4">
            {availableTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                <p className="text-gray-500">No rescue tasks available right now. Great news!</p>
              </div>
            ) : (
              availableTasks.map(task => (
                <div key={task.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
                  <div className="min-w-0">
                    <h3 className="font-bold text-lg">{task.itemName}</h3>
                    <p className="text-gray-600">{task.restaurantName}</p>
                    <div className="mt-2 flex flex-col gap-2 text-sm text-gray-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                      <div className="flex items-start gap-1">
                        <MapPin size={16} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 break-words">{task.location?.address || 'Unknown Location'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={16} className="shrink-0" />
                        <span className="text-red-500 font-medium">Pickup ASAP</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAcceptTask(task)}
                    className="w-full rounded-xl bg-green-600 px-6 py-3 font-bold text-white transition hover:bg-green-700 md:w-auto"
                  >
                    Accept Rescue
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'my-tasks' && (
          <div className="space-y-4">
            {myTasks.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl border border-dashed">
                <p className="text-gray-500">You don't have any active tasks.</p>
              </div>
            ) : (
              myTasks.map(task => (
                <div key={task.id} className="rounded-2xl border-l-4 border-green-500 bg-white p-5 shadow-md sm:p-6">
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="font-bold text-xl">{task.listingDetails?.itemName}</h3>
                      <p className="text-gray-600">{task.listingDetails?.restaurantName}</p>
                    </div>
                    <span className="self-start rounded-full bg-blue-100 px-2 py-1 text-xs font-bold uppercase text-blue-800">{task.status.replace('_', ' ')}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                    <div>
                      <h4 className="font-bold text-sm text-gray-700 mb-2">Pickup From</h4>
                      <p className="text-sm">{task.listingDetails?.restaurantName}</p>
                      <p className="text-sm text-gray-500">{task.listingDetails?.location?.address}</p>
                      <button className="text-green-600 text-sm font-medium mt-1 flex items-center gap-1">
                        <Navigation size={14} /> Navigate
                      </button>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-gray-700 mb-2">Deliver To</h4>
                      <p className="text-sm">Local Food Bank (Simulated)</p>
                      <p className="text-sm text-gray-500">123 Charity Lane</p>
                      <button className="text-green-600 text-sm font-medium mt-1 flex items-center gap-1">
                        <Navigation size={14} /> Navigate
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap">
                    {task.pickupQr && (
                      <button
                        onClick={() =>
                          setQrModal({
                            title: 'Volunteer Pickup QR',
                            code: task.pickupQr!,
                            description: 'Show this QR at the restaurant so they can verify you before handing over the food.',
                          })
                        }
                        className="rounded-xl border border-green-200 px-4 py-3 text-sm font-bold text-green-700 hover:bg-green-50"
                      >
                        Show Pickup QR
                      </button>
                    )}

                    {task.status === 'accepted' && (
                      <button
                        onClick={() => handleConfirmPickup(task)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-bold text-white transition hover:bg-blue-700"
                      >
                        <Package size={20} /> Confirm Pickup
                      </button>
                    )}

                    {task.status === 'picked_up' && task.deliveryQr && (
                      <button
                        onClick={() =>
                          setQrModal({
                            title: 'NGO Delivery QR',
                            code: task.deliveryQr!,
                            description: 'Show this QR at the NGO so they can confirm receipt and close the rescue.',
                          })
                        }
                        className="rounded-xl border border-blue-200 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-50"
                      >
                        Show Delivery QR
                      </button>
                    )}
                  </div>

                  {task.status === 'picked_up' && (
                    <p className="mt-4 text-sm text-gray-500">The NGO will confirm final delivery once the donation is received.</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {qrModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{qrModal.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{qrModal.description}</p>
              </div>
              <button onClick={() => setQrModal(null)} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-center">
              <div className="mb-4 inline-flex rounded-full bg-green-100 p-3 text-green-700">
                <QrCode size={28} />
              </div>
              <div className="inline-block rounded-xl bg-white p-4 shadow-sm">
                <QRCodeCanvas value={qrModal.code} size={190} />
              </div>
              <p className="mt-4 break-all text-xs text-gray-400">{qrModal.code}</p>
            </div>

            <button onClick={() => setQrModal(null)} className="mt-4 w-full rounded-xl bg-gray-900 py-3 font-bold text-white transition hover:bg-gray-800">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VolunteerDashboard;
