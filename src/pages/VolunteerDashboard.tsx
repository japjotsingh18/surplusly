import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Listing, RescueTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { MapPin, Clock, CheckCircle, Navigation, Package } from 'lucide-react';
import { format } from 'date-fns';

const VolunteerDashboard: React.FC = () => {
  const { user } = useAuth();
  const [availableTasks, setAvailableTasks] = useState<Listing[]>([]);
  const [myTasks, setMyTasks] = useState<RescueTask[]>([]);
  const [activeTab, setActiveTab] = useState<'available' | 'my-tasks'>('available');

  // Fetch available rescue tasks (Listings in rescue_mode)
  useEffect(() => {
    const q = query(
      collection(db, 'listings'),
      where('status', '==', 'rescue_mode')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        pickupBy: doc.data().pickupBy.toDate(),
      })) as Listing[];
      tasks.sort((a, b) => a.pickupBy.getTime() - b.pickupBy.getTime());
      setAvailableTasks(tasks);
    });

    return () => unsubscribe();
  }, []);

  // Fetch my accepted tasks
  useEffect(() => {
    if (!user) return;
    
    const q = query(
      collection(db, 'rescue_tasks'),
      where('volunteerId', '==', user.id),
      where('status', 'in', ['accepted', 'picked_up'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Enriching with some listing data would happen here or via separate fetch
        // For MVP we assume we have enough info or fetch it separately
      })) as RescueTask[];
      setMyTasks(tasks);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAcceptTask = async (listing: Listing) => {
    if (!user) return;

    try {
      // 1. Create Rescue Task
      await addDoc(collection(db, 'rescue_tasks'), {
        listingId: listing.id,
        volunteerId: user.id,
        status: 'accepted',
        assignedAt: serverTimestamp(),
        listingDetails: listing // Denormalize for easier display in MVP
      });

      // 2. Update Listing Status
      await updateDoc(doc(db, 'listings', listing.id), {
        status: 'assigned'
      });

      alert("Task accepted! Head to the My Tasks tab.");
    } catch (error) {
      console.error("Error accepting task:", error);
      alert("Failed to accept task");
    }
  };

  const handleUpdateStatus = async (taskId: string, newStatus: 'picked_up' | 'delivered') => {
    try {
      await updateDoc(doc(db, 'rescue_tasks', taskId), {
        status: newStatus
      });
      alert(`Task marked as ${newStatus.replace('_', ' ')}!`);
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Volunteer Dashboard</h1>
          <p className="text-gray-600">Thank you for being a food rescue hero!</p>
        </header>

        <div className="flex space-x-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('available')}
            className={`pb-2 px-4 font-medium ${activeTab === 'available' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
          >
            Available Tasks
          </button>
          <button
            onClick={() => setActiveTab('my-tasks')}
            className={`pb-2 px-4 font-medium ${activeTab === 'my-tasks' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-500'}`}
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
                <div key={task.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h3 className="font-bold text-lg">{task.itemName}</h3>
                    <p className="text-gray-600">{task.restaurantName}</p>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <MapPin size={16} />
                        <span>{task.location?.address || 'Unknown Location'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={16} />
                        <span className="text-red-500 font-medium">Pickup ASAP</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAcceptTask(task)}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition w-full md:w-auto"
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
              myTasks.map((task: any) => (
                <div key={task.id} className="bg-white p-6 rounded-xl shadow-md border-l-4 border-green-500">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-xl">{task.listingDetails?.itemName}</h3>
                      <p className="text-gray-600">{task.listingDetails?.restaurantName}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold uppercase">
                      {task.status.replace('_', ' ')}
                    </span>
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

                  <div className="flex gap-4">
                    {task.status === 'accepted' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'picked_up')}
                        className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                      >
                        <Package size={20} /> Confirm Pickup
                      </button>
                    )}
                    {task.status === 'picked_up' && (
                      <button
                        onClick={() => handleUpdateStatus(task.id, 'delivered')}
                        className="flex-1 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle size={20} /> Confirm Delivery
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VolunteerDashboard;
