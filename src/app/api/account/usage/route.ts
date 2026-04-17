// ABOUTME: Authenticated endpoint returning a user's LLM usage for a given calendar month.
// ABOUTME: Returns lifetime total from user_credits, tier limit from admin_config, and month-filtered events.
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { supabase } from '@/lib/db';

interface UserCreditsRow { total_cost_usd: number }
interface TierLimitsConfig { value: Record<string, number | null> }

interface GroupedAction {
  action_id: string | null;
  created_at: string;
  service: string;
  total_cost_usd: number;
}

function groupEventsByAction(events: { id: string; created_at: string | null; service: string | null; action_id: string | null; input_cost_usd: number | null; output_cost_usd: number | null }[] | null): GroupedAction[] {
  if (!events || events.length === 0) return [];

  const groups = new Map<string, GroupedAction>();

  for (const event of events) {
    const key = event.action_id ?? event.id; // null action_id events each get their own row
    const cost = (event.input_cost_usd as number) + (event.output_cost_usd as number);

    if (groups.has(key)) {
      const existing = groups.get(key)!;
      existing.total_cost_usd += cost;
      // Keep the earliest created_at for the group
      if ((event.created_at as string) < existing.created_at) {
        existing.created_at = event.created_at as string;
      }
    } else {
      groups.set(key, {
        action_id: event.action_id as string | null,
        created_at: event.created_at as string,
        service: event.service as string,
        total_cost_usd: cost,
      });
    }
  }

  // Return sorted most-recent first
  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

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
      .select('id, created_at, service, action_id, input_cost_usd, output_cost_usd')
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
    events: groupEventsByAction(eventsResult.data),
  });
}
