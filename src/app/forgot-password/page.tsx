// ABOUTME: Page for requesting a password reset email.
// ABOUTME: Always shows a success message after submit to avoid leaking email existence.
'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch {
      // Intentionally swallow errors — always show success message
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-2 text-center">
          Reset Password
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {submitted ? (
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
            If that email is registered, you&apos;ll receive a reset link shortly.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="input-dark w-full rounded-lg px-4 py-2 text-white"
                placeholder="your.email@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg text-white font-medium"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="mt-4 text-center text-sm text-gray-400">
          <Link href="/login" className="text-purple-400 hover:text-purple-300">
            Back to login
          </Link>
        </p>
      </div>
    </div>
  );
}
