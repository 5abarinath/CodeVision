// ABOUTME: Account management page with Profile and Usage tabs accessible from the navbar dropdown.
// ABOUTME: Profile tab allows editing name; Usage tab shows monthly LLM spend and per-call event history.
'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import InitialsAvatar from '@/components/InitialsAvatar';

interface UsageEvent {
  id: string;
  created_at: string;
  service: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  input_cost_usd: number;
  output_cost_usd: number;
}

interface UsageData {
  total_cost_usd: number;
  tier: string;
  tier_limit_usd: number | null;
  events: UsageEvent[];
}

function AccountContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'usage'>(
    searchParams.get('tab') === 'usage' ? 'usage' : 'profile'
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name ?? '');
      setLastName(user.last_name ?? '');
    }
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const fetchUsage = useCallback(async (month: string) => {
    setUsageLoading(true);
    setUsageError('');
    try {
      const res = await fetch(`/api/account/usage?month=${month}`);
      if (!res.ok) throw new Error('Failed to load usage');
      setUsageData(await res.json());
    } catch {
      setUsageError('Failed to load usage data. Try again.');
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'usage' && user) {
      void fetchUsage(currentMonth);
    }
  }, [activeTab, currentMonth, user, fetchUsage]);

  const handleProfileSave = async () => {
    setProfileError('');
    setProfileSuccess(false);
    if (!firstName.trim()) { setProfileError('First name is required'); return; }
    setProfileSaving(true);
    try {
      const res = await fetch('/api/account/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: firstName.trim(), last_name: lastName.trim() || null }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed to save'); }
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setProfileSaving(false);
    }
  };

  const navigateMonth = (direction: -1 | 1) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const d = new Date(year, month - 1 + direction, 1);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (next <= new Date().toISOString().slice(0, 7)) setCurrentMonth(next);
  };

  const formatMonth = (month: string) => {
    const [year, m] = month.split('-').map(Number);
    return new Date(year, m - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-400">Loading...</span>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors mb-8"
        >
          ← Back
        </button>

        <div className="flex gap-8">
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {(['profile', 'usage'] as const).map(tab => (
                <li key={tab}>
                  <button
                    onClick={() => {
                      setActiveTab(tab);
                      router.replace(tab === 'usage' ? '/account?tab=usage' : '/account', { scroll: false });
                    }}
                    className={`w-full text-left px-4 py-2 rounded-lg text-sm capitalize transition-colors ${
                      activeTab === tab
                        ? 'border-l-2 border-purple-500 text-white bg-white/5'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 glass rounded-xl p-6">
            {activeTab === 'profile' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Profile</h2>

                <div className="flex items-center gap-4 mb-6">
                  <InitialsAvatar firstName={user.first_name} lastName={user.last_name} email={user.email} size={64} />
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      value={user.email}
                      disabled
                      className="input-dark rounded-lg px-4 py-2 text-gray-400 opacity-50 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">First name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={e => { setFirstName(e.target.value); setProfileSuccess(false); }}
                      className="input-dark w-full rounded-lg px-4 py-2 text-white"
                      placeholder="First name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                      Last name <span className="text-gray-500">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={e => { setLastName(e.target.value); setProfileSuccess(false); }}
                      className="input-dark w-full rounded-lg px-4 py-2 text-white"
                      placeholder="Last name (optional)"
                    />
                  </div>
                </div>

                {profileError && <p className="mt-3 text-sm text-red-400">{profileError}</p>}
                {profileSuccess && <p className="mt-3 text-sm text-green-400">Profile saved successfully.</p>}

                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="btn-primary mt-6 px-6 py-2 rounded-lg text-white font-medium"
                >
                  {profileSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            )}

            {activeTab === 'usage' && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-6">Usage</h2>

                {usageLoading && <p className="text-gray-400 text-sm">Loading...</p>}

                {usageError && (
                  <div className="mb-4">
                    <p className="text-red-400 text-sm">{usageError}</p>
                    <button onClick={() => void fetchUsage(currentMonth)} className="mt-2 text-sm text-purple-400 hover:text-purple-300">
                      Try again
                    </button>
                  </div>
                )}

                {usageData && (
                  <>
                    <div className="glass rounded-xl p-5 mb-6">
                      <p className="text-sm text-gray-400 mb-1">Total spend</p>
                      <p className="text-4xl font-bold text-white mb-3">${usageData.total_cost_usd.toFixed(4)}</p>
                      <div className="w-full bg-white/10 rounded-full h-2">
                        {usageData.tier_limit_usd === null ? (
                          <div className="bg-purple-500 h-2 rounded-full w-full" />
                        ) : (
                          <div
                            className="bg-purple-500 h-2 rounded-full"
                            style={{ width: `${Math.min(100, (usageData.total_cost_usd / usageData.tier_limit_usd) * 100)}%` }}
                          />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {usageData.tier_limit_usd === null
                          ? 'Unlimited'
                          : `$${usageData.total_cost_usd.toFixed(4)} of $${usageData.tier_limit_usd.toFixed(2)} limit`}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <button onClick={() => navigateMonth(-1)} className="text-gray-400 hover:text-white transition-colors px-2">←</button>
                      <span className="text-sm text-gray-300 min-w-32 text-center">{formatMonth(currentMonth)}</span>
                      <button
                        onClick={() => navigateMonth(1)}
                        disabled={currentMonth >= new Date().toISOString().slice(0, 7)}
                        className="text-gray-400 hover:text-white transition-colors px-2 disabled:opacity-30"
                      >→</button>
                    </div>

                    {usageData.events.length === 0 ? (
                      <p className="text-center text-gray-500 py-8 text-sm">No usage recorded for this month.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-400 border-b border-white/10 text-left">
                              <th className="pb-2 pr-4 font-medium">Date</th>
                              <th className="pb-2 pr-4 font-medium">Service</th>
                              <th className="pb-2 pr-4 font-medium">Model</th>
                              <th className="pb-2 pr-4 font-medium text-right">Input</th>
                              <th className="pb-2 pr-4 font-medium text-right">Output</th>
                              <th className="pb-2 font-medium text-right">Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {usageData.events.map(event => (
                              <tr key={event.id} className="border-b border-white/5 text-gray-300">
                                <td className="py-2 pr-4 text-xs">
                                  {new Date(event.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}{' '}
                                  {new Date(event.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-2 pr-4 capitalize">{event.service}</td>
                                <td className="py-2 pr-4 font-mono text-xs">{event.model}</td>
                                <td className="py-2 pr-4 text-right">{event.input_tokens.toLocaleString()}</td>
                                <td className="py-2 pr-4 text-right">{event.output_tokens.toLocaleString()}</td>
                                <td className="py-2 text-right">${(event.input_cost_usd + event.output_cost_usd).toFixed(4)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="text-gray-400">Loading...</span></div>}>
      <AccountContent />
    </Suspense>
  );
}
