// ABOUTME: API route for completing a password reset using a one-time token.
// ABOUTME: Validates the token, updates the password, and marks the token as used.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateResetToken, markTokenUsed } from '@/lib/repositories/password-resets';
import { updateUserPassword } from '@/lib/repositories/users';

const ResetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    let resetRecord: { id: string; userId: string } | null;
    try {
      resetRecord = await validateResetToken(token);
    } catch (tokenError) {
      console.error('Reset password — validateResetToken threw:', tokenError);
      return NextResponse.json({ error: 'Failed to validate reset token' }, { status: 500 });
    }

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Reset link is invalid or has expired' },
        { status: 400 }
      );
    }

    console.log('Reset password — token valid, userId:', resetRecord.userId);

    try {
      await updateUserPassword(resetRecord.userId, password);
    } catch (updateError) {
      console.error('Reset password — updateUserPassword failed:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    await markTokenUsed(resetRecord.id);

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Reset password — unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
