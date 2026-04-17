// ABOUTME: Repository for managing password reset tokens.
// ABOUTME: Handles secure token generation, hashing, validation, and one-time-use marking.
import { supabase } from '../db';
import type { PasswordReset } from '../db';
import crypto from 'crypto';

const TOKEN_EXPIRY_HOURS = 1;

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createPasswordReset(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

  const { error } = await supabase
    .from('password_resets')
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
    });

  if (error) {
    console.error('Error creating password reset:', error);
    throw new Error('Failed to create password reset');
  }

  return token;
}

export async function validateResetToken(
  rawToken: string
): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashToken(rawToken);

  const { data, error } = await supabase
    .from('password_resets')
    .select('id, user_id')
    .eq('token_hash', tokenHash)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data) {
    return null;
  }

  const reset = data as Pick<PasswordReset, 'id' | 'user_id'>;
  return { id: reset.id, userId: reset.user_id };
}

export async function markTokenUsed(id: string): Promise<void> {
  await supabase
    .from('password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id);
}
