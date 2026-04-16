// ABOUTME: Top navigation bar with logo and authenticated user menu.
// ABOUTME: Shows initials avatar and first name; clicking opens a dropdown with tier badge, account links, and logout.
'use client';

import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { LogoFull } from '@/components/Logo';
import InitialsAvatar from '@/components/InitialsAvatar';

export default function NavBar() {
  const { user, loading, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <nav className="glass-strong sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="group">
              <LogoFull className="group-hover:opacity-80 transition-opacity" />
            </Link>
          </div>

          <div className="flex items-center gap-4">
            {loading ? (
              <span className="text-sm text-gray-400">Loading...</span>
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(prev => !prev)}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <InitialsAvatar
                    firstName={user.first_name}
                    lastName={user.last_name}
                    email={user.email}
                    size={32}
                  />
                  <span className="text-sm text-gray-300">
                    {user.first_name || user.email.split('@')[0]}
                  </span>
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 glass rounded-xl border border-white/10 shadow-lg py-1 z-50">
                    <div className="px-3 py-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        user.tier === 'pro'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                      }`}>
                        {user.tier === 'pro' ? 'Pro' : 'Free'}
                      </span>
                    </div>
                    <Link
                      href="/account"
                      className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Profile
                    </Link>
                    <Link
                      href="/account?tab=usage"
                      className="block px-4 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      Usage
                    </Link>
                    <hr className="my-1 border-white/10" />
                    <button
                      onClick={() => { setDropdownOpen(false); void logout(); }}
                      className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Login
                </Link>
                <Link href="/signup" className="btn-primary px-4 py-2 text-sm text-white rounded-lg">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
