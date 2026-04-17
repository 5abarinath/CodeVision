// ABOUTME: API route for initiating the password reset flow.
// ABOUTME: Always returns 200 to avoid leaking whether an email is registered.
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getUserByEmail } from '@/lib/repositories/users';
import { createPasswordReset } from '@/lib/repositories/password-resets';
import { sendPasswordResetEmail } from '@/lib/services/email';

const ForgotPasswordSchema = z.object({
  email: z.string().email('Invalid email'),
});

const SUCCESS_MESSAGE = "If that email is registered, you'll receive a reset link shortly";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ForgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    try {
      const user = await getUserByEmail(email);
      if (user && user.email_verified) {
        const token = await createPasswordReset(user.id);
        await sendPasswordResetEmail({ email: user.email, token });
      }
    } catch (err) {
      console.error('Password reset error (internal):', err);
    }

    return NextResponse.json({ message: SUCCESS_MESSAGE });
  } catch (error) {
    console.error('Forgot password route error:', error);
    return NextResponse.json({ message: SUCCESS_MESSAGE });
  }
}
