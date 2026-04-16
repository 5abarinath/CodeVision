// ABOUTME: Returns the authenticated user's public profile fields from their session cookie.
// ABOUTME: Used by the client-side useAuth hook to populate user state on page load.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      tier: user.tier,
    },
  });
}
