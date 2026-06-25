import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import RestaurantDashboard from "./pages/RestaurantDashboard";
import CustomerView from "./pages/CustomerView";
import VolunteerDashboard from "./pages/VolunteerDashboard";
import NGODashboard from "./pages/NGODashboard";
import { isFirebaseInitialized, initializationError } from './lib/firebase';
import { AlertTriangle } from 'lucide-react';

export default function App() {
  if (!isFirebaseInitialized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-lg w-full p-8 rounded-xl shadow-lg border-l-4 border-red-500">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-red-100 p-3 rounded-full text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Configuration Required</h1>
          </div>
          
          <p className="text-gray-600 mb-6">
            Surplusly needs to connect to Firebase to work, but the configuration is missing or invalid.
          </p>

          <div className="bg-gray-100 p-4 rounded-lg mb-6 overflow-x-auto">
            <code className="text-sm text-red-600 font-mono">
              Error: {initializationError || 'Missing API Key'}
            </code>
          </div>

          <h3 className="font-bold text-gray-800 mb-2">How to fix:</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-6">
            <li>Create a <code className="bg-gray-200 px-1 rounded">.env</code> file in the project root.</li>
            <li>Copy the contents from <code className="bg-gray-200 px-1 rounded">.env.example</code>.</li>
            <li>Fill in your actual Firebase project credentials.</li>
            <li>Restart the development server.</li>
          </ol>
          
          <div className="text-xs text-gray-400 border-t pt-4">
            Note: You can find these credentials in your Firebase Console under Project Settings.
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Register />} />
          
          {/* Protected Routes - In a real app, these would be wrapped in a PrivateRoute component */}
          <Route path="/restaurant/dashboard" element={<RestaurantDashboard />} />
          <Route path="/customer/browse" element={<CustomerView />} />
          <Route path="/volunteer/dashboard" element={<VolunteerDashboard />} />
          <Route path="/ngo/dashboard" element={<NGODashboard />} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
