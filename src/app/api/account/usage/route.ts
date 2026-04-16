// ABOUTME: Authenticated endpoint returning a user's LLM usage for a given calendar month.
// ABOUTME: Returns lifetime total from user_credits, tier limit from admin_config, and month-filtered events.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';

interface UserCreditsRow { total_cost_usd: number }
interface TierLimitsConfig { value: Record<string, number | null> }

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get('month') ?? new Date().toISOString().slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(monthParam)) {
    return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
  }

  const [yearStr, monthStr] = monthParam.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12
  const periodStart = new Date(Date.UTC(year, month - 1, 1));
  const periodEnd = new Date(Date.UTC(year, month, 1));

  const [creditsResult, configResult, eventsResult] = await Promise.all([
    supabase.from('user_credits').select('total_cost_usd').eq('user_id', user.id).single(),
    supabase.from('admin_config').select('value').eq('key', 'tier_limits').single(),
    supabase
      .from('llm_usage_events')
      .select('id, created_at, service, model, input_tokens, output_tokens, input_cost_usd, output_cost_usd')
      .eq('user_id', user.id)
      .gte('created_at', periodStart.toISOString())
      .lt('created_at', periodEnd.toISOString())
      .order('created_at', { ascending: false }),
  ]);

  if (eventsResult.error) {
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
  }

  // PGRST116 means no row found — treat as zero cost. Any other DB error is a genuine failure.
  if (creditsResult.error) {
    if (creditsResult.error.code !== 'PGRST116') {
      console.error('Failed to fetch user_credits:', creditsResult.error);
      return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 });
    }
  }

  const creditsData = creditsResult.data as UserCreditsRow | null;
  const total_cost_usd: number = creditsData ? creditsData.total_cost_usd : 0;

  const configData = configResult.data as TierLimitsConfig | null;
  const tierLimits: Record<string, number | null> =
    configData && typeof configData.value === 'object' && configData.value !== null
      ? configData.value
      : { free: 5.0, pro: null };

  return NextResponse.json({
    total_cost_usd,
    tier: user.tier,
    tier_limit_usd: tierLimits[user.tier] ?? null,
    events: eventsResult.data ?? [],
  });
}
