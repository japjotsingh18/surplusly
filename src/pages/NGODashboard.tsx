import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { RescueTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { Truck, CheckCircle, Package, Clock } from 'lucide-react';
import { format } from 'date-fns';

const NGODashboard: React.FC = () => {
  const { user } = useAuth();
  const [incomingDeliveries, setIncomingDeliveries] = useState<RescueTask[]>([]);
  const [history, setHistory] = useState<RescueTask[]>([]);
  const [isAccepting, setIsAccepting] = useState(true);

  // Fetch incoming deliveries (status = picked_up)
  useEffect(() => {
    // In a real app, we would filter by NGO ID, but for MVP we show all or simulate assignment
    const q = query(
      collection(db, 'rescue_tasks'),
      where('status', '==', 'picked_up')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RescueTask[];
      setIncomingDeliveries(tasks);
    });

    return () => unsubscribe();
  }, []);

  // Fetch history (status = delivered)
  useEffect(() => {
    const q = query(
      collection(db, 'rescue_tasks'),
      where('status', '==', 'delivered')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as RescueTask[];
      tasks.sort((a, b) => (b.assignedAt?.getTime?.() ?? 0) - (a.assignedAt?.getTime?.() ?? 0));
      setHistory(tasks);
    });

    return () => unsubscribe();
  }, []);

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
              className={`px-4 py-2 rounded-md font-bold transition ${
                isAccepting ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}
            >
              {isAccepting ? 'Accepting Deliveries' : 'Not Accepting'}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Incoming Deliveries Column */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Truck className="text-blue-600" /> Incoming Deliveries
            </h2>
            
            {incomingDeliveries.length === 0 ? (
              <div className="bg-white p-8 rounded-xl shadow-sm border border-dashed text-center">
                <p className="text-gray-500">No deliveries currently on the way.</p>
              </div>
            ) : (
              incomingDeliveries.map((task: any) => (
                <div key={task.id} className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500 animate-in slide-in-from-left-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg">{task.listingDetails?.itemName}</h3>
                      <p className="text-gray-600">From: {task.listingDetails?.restaurantName}</p>
                    </div>
                    <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">
                      ON THE WAY
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Clock size={16} />
                    <span>ETA: ~15 mins</span>
                  </div>

                  <div className="bg-gray-50 p-3 rounded-lg text-sm mb-4">
                    <p className="font-medium">Volunteer Courier:</p>
                    <p>John Doe (Simulated)</p>
                  </div>

                  <button className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 transition">
                    Scan QR to Confirm Receipt
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Recent History Column */}
          <div className="space-y-6">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Package className="text-gray-600" /> Recent History
            </h2>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              {history.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No past deliveries.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {history.map((task: any) => (
                    <div key={task.id} className="p-4 hover:bg-gray-50 transition">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-gray-900 line-clamp-1">{task.listingDetails?.itemName}</span>
                        <span className="text-green-600 text-xs font-bold whitespace-nowrap">DELIVERED</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-1">{task.listingDetails?.restaurantName}</p>
                      <p className="text-xs text-gray-400">
                        {task.assignedAt ? format(task.assignedAt.toDate(), 'MMM d, h:mm a') : ''}
                      </p>
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
