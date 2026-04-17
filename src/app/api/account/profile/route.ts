// ABOUTME: Authenticated endpoint to update a user's first and last name.
// ABOUTME: Validates input with Zod, writes to users table, and returns the updated fields.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';
import { z } from 'zod';

const ProfileUpdateSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().nullable().optional(),
});

export async function PUT(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { first_name, last_name } = parsed.data;

  const { data, error } = await supabase
    .from('users')
    .update({ first_name, last_name: last_name ?? null })
    .eq('id', user.id)
    .select('id, email, first_name, last_name, tier')
    .single();

  if (error) {
    console.error('[profile route] Supabase update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }

  return NextResponse.json({ user: data });
}
