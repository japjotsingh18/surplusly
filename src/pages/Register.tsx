import React, { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Check, HandHeart, Leaf, Loader2, Store, Truck } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { UserRole } from '../types';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(2, 'Name is required'),
  role: z.enum(['restaurant', 'customer', 'volunteer', 'ngo'] as [UserRole, ...UserRole[]]),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const roleOptions: Array<{
  value: UserRole;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: 'customer',
    title: 'Customer',
    description: 'Find discounted surplus food nearby.',
    icon: Store,
  },
  {
    value: 'restaurant',
    title: 'Restaurant',
    description: 'Post extra food before it goes to waste.',
    icon: Building2,
  },
  {
    value: 'volunteer',
    title: 'Volunteer',
    description: 'Help rescue unclaimed food.',
    icon: Truck,
  },
  {
    value: 'ngo',
    title: 'NGO',
    description: 'Receive and confirm donated food.',
    icon: HandHeart,
  },
];

const isUserRole = (role: string | null): role is UserRole =>
  role === 'customer' || role === 'restaurant' || role === 'volunteer' || role === 'ngo';

const Register: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedRole = searchParams.get('role');
  const defaultRole = isUserRole(requestedRole) ? requestedRole : 'customer';

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: defaultRole,
    },
  });

  const selectedRole = watch('role');
  const selectedRoleLabel = useMemo(
    () => roleOptions.find(role => role.value === selectedRole)?.title ?? 'Customer',
    [selectedRole]
  );

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, data.email, data.password);

      await setDoc(doc(db, 'users', user.uid), {
        email: data.email,
        name: data.name,
        role: data.role,
        phone: data.phone || '',
        address: data.address ? { street: data.address, city: '', state: '', zipCode: '' } : null,
        createdAt: serverTimestamp(),
      });

      switch (data.role) {
        case 'restaurant':
          navigate('/restaurant/dashboard');
          break;
        case 'volunteer':
          navigate('/volunteer/dashboard');
          break;
        case 'ngo':
          navigate('/ngo/dashboard');
          break;
        default:
          navigate('/customer/browse');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      alert('Registration failed: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.16),_transparent_32%),linear-gradient(135deg,#f8fafc_0%,#eefcf3_100%)] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="hidden overflow-hidden rounded-[32px] bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 p-8 text-white shadow-2xl shadow-green-900/20 lg:block">
          <Link to="/" className="inline-flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-green-600">
              <Leaf className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-2xl font-black tracking-tight">Surplusly</span>
              <span className="text-xs font-bold uppercase tracking-[0.24em] text-white/70">Food rescue marketplace</span>
            </span>
          </Link>

          <div className="mt-16">
            <p className="mb-4 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-bold backdrop-blur">
              Join as a {selectedRoleLabel}
            </p>
            <h1 className="max-w-lg text-5xl font-black leading-[0.95] tracking-tight">
              Turn surplus food into real community impact.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-white/85">
              Create your account to post discounted food, reserve nearby deals, rescue unclaimed meals, or confirm NGO drop-offs.
            </p>
          </div>

          <div className="mt-12 grid gap-3">
            {['Discounted surplus meals', 'QR-confirmed handoffs', 'Customer pickup to rescue mode'].map(item => (
              <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/12 px-4 py-3 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-green-700">
                  <Check className="h-4 w-4" />
                </span>
                <span className="font-semibold">{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="w-full rounded-[28px] bg-white p-5 shadow-xl shadow-slate-200/70 sm:p-8 lg:p-10">
          <div className="mb-8 text-center sm:text-left">
            <Link to="/" className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-2 text-sm font-black text-green-700 sm:mx-0 lg:hidden">
              <Leaf className="h-4 w-4" />
              Surplusly
            </Link>
            <h2 className="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Create your account</h2>
            <p className="mt-3 text-base text-slate-600">
              Already have one?{' '}
              <Link to="/auth/login" className="font-bold text-green-600 hover:text-green-500">
                Sign in instead
              </Link>
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <input type="hidden" {...register('role')} />

            <div>
              <label className="mb-3 block text-sm font-bold text-slate-800">Choose your role</label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {roleOptions.map(role => {
                  const Icon = role.icon;
                  const active = selectedRole === role.value;

                  return (
                    <button
                      key={role.value}
                      type="button"
                      onClick={() => setValue('role', role.value, { shouldValidate: true })}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        active
                          ? 'border-green-500 bg-green-50 shadow-sm ring-2 ring-green-100'
                          : 'border-slate-200 bg-white hover:border-green-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-black text-slate-950">
                          {role.title}
                          {active && <Check className="h-4 w-4 text-green-600" />}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-slate-500">{role.description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="name" className="mb-1.5 block text-sm font-bold text-slate-800">
                  {selectedRole === 'restaurant' ? 'Restaurant name' : selectedRole === 'ngo' ? 'Organization name' : 'Name'}
                </label>
                <input
                  {...register('name')}
                  type="text"
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  placeholder={selectedRole === 'restaurant' ? 'Spitz ASU' : selectedRole === 'ngo' ? 'Community Food Bank' : 'Your name'}
                />
                {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="email" className="mb-1.5 block text-sm font-bold text-slate-800">Email address</label>
                <input
                  {...register('email')}
                  type="email"
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  placeholder="you@example.com"
                />
                {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email.message}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-bold text-slate-800">Password</label>
                <input
                  {...register('password')}
                  type="password"
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  placeholder="At least 6 characters"
                />
                {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password.message}</p>}
              </div>

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-bold text-slate-800">Phone optional</label>
                <input
                  {...register('phone')}
                  type="tel"
                  className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
                  placeholder="Phone number"
                />
              </div>

              {(selectedRole === 'restaurant' || selectedRole === 'ngo') && (
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="mb-1.5 block text-sm font-bold text-slate-800">
                    {selectedRole === 'restaurant' ? 'Restaurant address' : 'Organization address'}
                  </label>
                  <input
                    {...register('address')}
                    type="text"
                    className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-green-500 focus:ring-4 focus:ring-green-100"
                    placeholder="1100 E Apache Blvd"
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-4 text-base font-black text-white shadow-lg shadow-green-600/20 transition hover:bg-green-700 disabled:opacity-70"
            >
              {isLoading && <Loader2 className="h-5 w-5 animate-spin" />}
              {isLoading ? 'Creating account...' : `Create ${selectedRoleLabel} Account`}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default Register;
