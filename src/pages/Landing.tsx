import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BellRing,
  Building2,
  Clock,
  HandHeart,
  Leaf,
  QrCode,
  ShoppingBag,
  Truck,
} from 'lucide-react';

const highlights = [
  {
    title: 'Discounted Food Deals',
    desc: 'Customers can reserve nearby surplus meals at reduced prices before the pickup window closes.',
    icon: Clock,
    color: 'text-green-600',
    bg: 'bg-green-50',
    ring: 'ring-green-100',
    tag: 'Save on meals',
  },
  {
    title: 'Auto Rescue Mode',
    desc: 'If food goes unclaimed, the workflow can route it toward volunteers and donation partners.',
    icon: HandHeart,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
    ring: 'ring-orange-100',
    tag: 'No waste fallback',
  },
  {
    title: 'QR-Confirmed Pickups',
    desc: 'Customers, restaurants, volunteers, and NGOs can verify each handoff with simple QR checkpoints.',
    icon: QrCode,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
    ring: 'ring-blue-100',
    tag: 'Verified flow',
  },
];

const steps = [
  {
    title: 'Post surplus',
    desc: 'Restaurants add extra food, quantity, price, dietary tags, and pickup deadline.',
    icon: Building2,
    accent: 'bg-green-600',
  },
  {
    title: 'Reserve nearby food',
    desc: 'Customers discover live deals, reserve a listing, and receive a pickup QR code.',
    icon: ShoppingBag,
    accent: 'bg-orange-500',
  },
  {
    title: 'Escalate if unclaimed',
    desc: 'Listings can move into rescue mode when the customer pickup window is running out.',
    icon: BellRing,
    accent: 'bg-red-500',
  },
  {
    title: 'Rescue and deliver',
    desc: 'Volunteers complete pickup and drop-off so NGOs can confirm receipt.',
    icon: Truck,
    accent: 'bg-blue-500',
  },
];

const Landing: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50">
      {/* Hero Section */}
      <header className="bg-gradient-to-r from-green-600 to-green-500 px-4 pb-16 pt-5 text-white sm:pb-20 sm:pt-6">
        <nav className="mx-auto mb-10 flex max-w-6xl items-center justify-between gap-4 sm:mb-16">
          <Link to="/" className="group flex items-center gap-3" aria-label="Surplusly home">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-green-600 shadow-lg shadow-green-900/10 transition group-hover:scale-105 sm:h-11 sm:w-11">
              <Leaf className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block text-xl font-black tracking-tight sm:text-2xl">Surplusly</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70 sm:text-xs sm:tracking-[0.28em]">
                Food rescue marketplace
              </span>
            </span>
          </Link>
          <Link
            to="/auth/login"
            className="hidden rounded-full border border-white/30 bg-white/10 px-5 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white hover:text-green-700 sm:inline-flex"
          >
            Sign in
          </Link>
        </nav>

        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between md:flex-row">
          <div className="mb-10 md:mb-0 md:w-1/2">
            <h1 className="mb-5 text-5xl font-black leading-[0.95] tracking-tight sm:text-6xl md:text-7xl">
              Save food.<br />Feed people.
            </h1>
            <p className="mb-7 max-w-xl text-lg leading-8 opacity-90 sm:text-xl">
              Discover discounted surplus food from nearby restaurants before it goes to waste. 
              If it is not claimed, Surplusly helps route it toward community rescue.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/customer/browse" className="flex items-center justify-center rounded-full bg-white px-8 py-4 font-bold text-green-600 transition hover:bg-gray-100">
                Find Food <ArrowRight className="ml-2 w-5 h-5" />
              </Link>
              <Link to="/auth/signup?role=restaurant" className="flex items-center justify-center rounded-full bg-green-700 px-8 py-4 font-bold text-white transition hover:bg-green-800">
                I'm a Restaurant
              </Link>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium">
              <Link to="/auth/signup?role=volunteer" className="hover:underline">Volunteer to Rescue</Link>
              <span className="opacity-50">|</span>
              <Link to="/auth/signup?role=ngo" className="hover:underline">NGO Partner</Link>
            </div>
          </div>
          <div className="flex w-full justify-center md:w-1/2">
            <div className="w-full max-w-sm rounded-3xl border border-white/30 bg-white/20 p-5 shadow-xl backdrop-blur-sm sm:p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-2xl">🍔</div>
                <div className="min-w-0">
                  <div className="font-bold">Spicy Chicken Burger</div>
                  <div className="text-sm opacity-90">Only 3 left • 40% OFF</div>
                </div>
              </div>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-sm line-through opacity-70">$12.00</div>
                  <div className="text-2xl font-bold">$7.20</div>
                </div>
                <div className="rounded-full bg-white px-4 py-2 text-center text-sm font-bold text-green-600">
                  00:45:00 left
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MVP Highlights */}
      <section className="-mt-8 px-4 pb-14 sm:-mt-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 gap-4 md:grid-cols-3">
          {highlights.map((item) => {
            const Icon = item.icon;

            return (
              <article
                key={item.title}
                className="group rounded-3xl border border-gray-100 bg-white p-6 shadow-xl shadow-gray-200/60 transition duration-300 hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="mb-5 flex items-center justify-between">
                  <div className={`${item.bg} ${item.color} ${item.ring} flex h-14 w-14 items-center justify-center rounded-2xl ring-8 transition group-hover:scale-105`}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                    {item.tag}
                  </span>
                </div>
                <h2 className="mb-3 text-2xl font-black tracking-tight text-gray-900">{item.title}</h2>
                <p className="text-base leading-7 text-gray-600">{item.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="relative overflow-hidden px-4 py-16 sm:py-20">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)]" />
        <div className="max-w-6xl mx-auto">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <span className="mb-4 inline-flex rounded-full bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
              Browse to pickup to rescue
            </span>
            <h2 className="text-3xl font-black tracking-tight text-gray-900 sm:text-4xl md:text-5xl">How Surplusly Works</h2>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              The MVP keeps the food journey simple: list it, reserve it, and rescue it before it becomes waste.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, i) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.title}
                  className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className={`absolute left-0 top-0 h-1.5 w-full ${step.accent}`} />
                  <div className="mb-8 flex items-start justify-between">
                    <div className={`${step.accent} flex h-14 w-14 items-center justify-center rounded-2xl p-3 text-white shadow-lg`}>
                      <Icon className="h-7 w-7" />
                    </div>
                    <span className="text-5xl font-black leading-none text-gray-100">0{i + 1}</span>
                  </div>
                  <h3 className="mb-3 text-2xl font-black text-gray-950">{step.title}</h3>
                  <p className="text-base leading-7 text-gray-600">{step.desc}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Landing;
