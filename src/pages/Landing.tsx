import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, Heart, MapPin } from 'lucide-react';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-green-600 to-green-500 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="md:w-1/2 mb-10 md:mb-0">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Save food.<br />Feed people.
            </h1>
            <p className="text-xl mb-8 opacity-90">
              Surplusly bridges the gap between restaurant surplus and community needs. 
              Join us in fighting food waste and hunger.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/customer/browse" className="bg-white text-green-600 px-8 py-3 rounded-full font-bold hover:bg-gray-100 transition flex items-center justify-center">
                Find Food <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link to="/auth/signup?role=restaurant" className="bg-green-700 text-white px-8 py-3 rounded-full font-bold hover:bg-green-800 transition flex items-center justify-center">
                I'm a Restaurant
              </Link>
            </div>
            <div className="mt-6 flex gap-4 text-sm font-medium">
              <Link to="/auth/signup?role=volunteer" className="hover:underline">Volunteer to Rescue</Link>
              <span className="opacity-50">|</span>
              <Link to="/auth/signup?role=ngo" className="hover:underline">NGO Partner</Link>
            </div>
          </div>
          <div className="md:w-1/2 flex justify-center">
            <div className="bg-white/20 p-8 rounded-2xl backdrop-blur-sm border border-white/30 shadow-xl max-w-sm">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-2xl">🍔</div>
                <div>
                  <div className="font-bold">Spicy Chicken Burger</div>
                  <div className="text-sm opacity-90">Only 3 left • 40% OFF</div>
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div>
                  <div className="text-sm line-through opacity-70">$12.00</div>
                  <div className="text-2xl font-bold">$7.20</div>
                </div>
                <div className="bg-white text-green-600 px-4 py-1 rounded-full text-sm font-bold">
                  00:45:00 left
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Impact Stats */}
      <section className="py-12 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
          <div className="p-6">
            <div className="text-green-600 mb-2 flex justify-center"><Leaf className="w-8 h-8" /></div>
            <div className="text-4xl font-bold text-gray-800 mb-1">1,250+</div>
            <div className="text-gray-500">Meals Saved</div>
          </div>
          <div className="p-6 border-l border-r border-gray-100">
            <div className="text-orange-500 mb-2 flex justify-center"><Heart className="w-8 h-8" /></div>
            <div className="text-4xl font-bold text-gray-800 mb-1">850 kg</div>
            <div className="text-gray-500">Food Rescued</div>
          </div>
          <div className="p-6">
            <div className="text-blue-500 mb-2 flex justify-center"><MapPin className="w-8 h-8" /></div>
            <div className="text-4xl font-bold text-gray-800 mb-1">45</div>
            <div className="text-gray-500">Local Partners</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-16 text-gray-800">How Surplusly Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { title: '1. Post Surplus', desc: 'Restaurants list extra food before closing.', icon: '🏪' },
              { title: '2. Customer Pickup', desc: 'Locals buy at a discount.', icon: '🛍️' },
              { title: '3. Rescue Mode', desc: 'Unclaimed food is flagged for rescue.', icon: '🚨' },
              { title: '4. Donate', desc: 'Volunteers deliver to NGOs.', icon: '🤝' },
            ].map((step, i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition border border-gray-100">
                <div className="text-4xl mb-4">{step.icon}</div>
                <h3 className="font-bold text-xl mb-2">{step.title}</h3>
                <p className="text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
