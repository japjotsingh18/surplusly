import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RescueTask } from '../types';
import { Truck, Package, Clock } from 'lucide-react';
import { format } from 'date-fns';

type RescueTaskRecord = RescueTask & {
  assignedAt?: Date | null;
};

const mapRescueTask = (snapshotDoc: any) =>
  ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
    assignedAt: snapshotDoc.data().assignedAt?.toDate?.() ?? snapshotDoc.data().assignedAt ?? null,
  }) as RescueTaskRecord;

const NGODashboard: React.FC = () => {
  const [incomingDeliveries, setIncomingDeliveries] = useState<RescueTaskRecord[]>([]);
  const [history, setHistory] = useState<RescueTaskRecord[]>([]);
  const [isAccepting, setIsAccepting] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'rescue_tasks'), snapshot => {
      const tasks = snapshot.docs.map(mapRescueTask);
      setIncomingDeliveries(tasks.filter(task => task.status === 'picked_up'));
      setHistory(
        tasks
          .filter(task => task.status === 'delivered')
          .sort((a, b) => (b.assignedAt instanceof Date ? b.assignedAt.getTime() : 0) - (a.assignedAt instanceof Date ? a.assignedAt.getTime() : 0))
      );
    });

    return () => unsubscribe();
  }, []);

  const handleConfirmReceipt = async (task: RescueTaskRecord) => {
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'rescue_tasks', task.id), {
        status: 'delivered',
      });
      batch.update(doc(db, 'listings', task.listingId), {
        status: 'delivered',
      });
      await batch.commit();
    } catch (error) {
      console.error('Error confirming NGO receipt:', error);
      alert('Failed to confirm receipt.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">NGO Dashboard</h1>
            <p className="text-gray-600">Manage incoming food donations.</p>
          </div>

          <div className="bg-white p-2 rounded-lg shadow-sm border flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 ml-2">Status:</span>
            <button
              onClick={() => setIsAccepting(!isAccepting)}
              className={`px-4 py-2 rounded-md font-bold transition ${isAccepting ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
            >
              {isAccepting ? 'Accepting Deliveries' : 'Not Accepting'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Truck className="text-blue-600" /> Incoming Deliveries
            </h2>

            {incomingDeliveries.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-dashed text-center">
                <p className="text-gray-500">No deliveries currently on the way.</p>
              </div>
            ) : (
              incomingDeliveries.map(task => (
                <div key={task.id} className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500 animate-in slide-in-from-left-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{task.listingDetails?.itemName}</h3>
                      <p className="text-gray-600">From: {task.listingDetails?.restaurantName}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">ON THE WAY</span>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Clock size={16} />
                    <span>Volunteer is en route to your location.</span>
                  </div>

                  <button onClick={() => handleConfirmReceipt(task)} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition">
                    Confirm Receipt
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="text-gray-600" /> Recent History
            </h2>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No past deliveries.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map(task => (
                    <div key={task.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-900 line-clamp-1">{task.listingDetails?.itemName}</span>
                        <span className="text-green-600 text-xs font-bold whitespace-nowrap">DELIVERED</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{task.listingDetails?.restaurantName}</p>
                      <p className="text-xs text-gray-400">{task.assignedAt instanceof Date ? format(task.assignedAt, 'MMM d, h:mm a') : ''}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NGODashboard;
