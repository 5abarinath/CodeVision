// ABOUTME: Thin wrapper around the Anthropic SDK that tracks LLM usage and enforces credit limits.
// ABOUTME: Reads config from admin_config (with caching), checks balances pre-call, and logs usage post-call.

import Anthropic from '@anthropic-ai/sdk';
import type { MessageCreateParamsNonStreaming, Message } from '@anthropic-ai/sdk/resources';
import { supabase } from './db';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnthropicClientOptions {
  userId: string;
  service: 'chat' | 'analysis' | 'alignment';
}

// Extend the standard params to accept optional metadata for usage logging
export type TrackedMessageCreateParams = Omit<MessageCreateParamsNonStreaming, 'model'> & {
  model?: string;
  metadata?: Record<string, unknown>;
};

export interface TrackedAnthropicMessages {
  create(params: TrackedMessageCreateParams): Promise<Message>;
}

// ─── Config cache ─────────────────────────────────────────────────────────────

interface PricingEntry {
  input_per_1m: number;
  output_per_1m: number;
}

interface ConfigCache {
  llmPricing: Record<string, PricingEntry> | null;
  tierLimits: Record<string, number | null> | null;
  defaultModel: string | null;
  fetchedAt: number | null;
}

const CONFIG_TTL_MS = 5 * 60 * 1000; // 5 minutes

const configCache: ConfigCache = {
  llmPricing: null,
  tierLimits: null,
  defaultModel: null,
  fetchedAt: null,
};

async function getAdminConfigValue<T>(key: string): Promise<T> {
  const { data, error } = await supabase
    .from('admin_config')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    throw new Error(`Failed to fetch admin_config key "${key}": ${error?.message ?? 'no data'}`);
  }

  return (data as { value: T }).value;
}

async function getConfig(): Promise<{
  llmPricing: Record<string, PricingEntry>;
  tierLimits: Record<string, number | null>;
  defaultModel: string;
}> {
  const now = Date.now();
  const cacheStale = configCache.fetchedAt === null || now - configCache.fetchedAt > CONFIG_TTL_MS;

  if (cacheStale) {
    const [llmPricing, tierLimits, defaultModel] = await Promise.all([
      getAdminConfigValue<Record<string, PricingEntry>>('llm_pricing'),
      getAdminConfigValue<Record<string, number | null>>('tier_limits'),
      getAdminConfigValue<string>('llm_default_model'),
    ]);
    configCache.llmPricing = llmPricing;
    configCache.tierLimits = tierLimits;
    configCache.defaultModel = defaultModel;
    configCache.fetchedAt = now;
  }

  return {
    llmPricing: configCache.llmPricing!,
    tierLimits: configCache.tierLimits!,
    defaultModel: configCache.defaultModel!,
  };
}

// ─── Credit check ─────────────────────────────────────────────────────────────

async function checkCreditLimit(userId: string, tierLimits: Record<string, number | null>): Promise<void> {
  // Fetch user tier
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('tier')
    .eq('id', userId)
    .single();

  if (userError || !userData) {
    throw new Error(`Failed to fetch user tier for userId "${userId}": ${userError?.message ?? 'no data'}`);
  }

  const tier: string = (userData as { tier: string }).tier;
  const limit = tierLimits[tier];

  // null means unlimited — skip check
  if (limit === null || limit === undefined) {
    return;
  }

  // Fetch current credit usage
  const { data: creditsData, error: creditsError } = await supabase
    .from('user_credits')
    .select('total_cost_usd')
    .eq('user_id', userId)
    .single();

  // PGRST116 = no rows found — new user with no spend yet, treat as $0
  if (creditsError && creditsError.code !== 'PGRST116') {
    console.warn(`[anthropic-client] Could not fetch user credits for "${userId}": ${creditsError.message}. Allowing call.`);
  }
  const totalCostUsd: number = creditsData
    ? (creditsData as { total_cost_usd: number }).total_cost_usd
    : 0;

  if (totalCostUsd >= limit) {
    throw new Error('Credit limit exceeded');
  }
}

// ─── Cost calculation ─────────────────────────────────────────────────────────

interface CostResult {
  inputCost: number;
  outputCost: number;
  totalCost: number;
}

function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  llmPricing: Record<string, PricingEntry>,
): CostResult {
  const pricing = llmPricing[model];

  if (!pricing) {
    console.warn(`[anthropic-client] No pricing entry found for model "${model}". Using 0 cost.`);
    return { inputCost: 0, outputCost: 0, totalCost: 0 };
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.input_per_1m;
  const outputCost = (outputTokens / 1_000_000) * pricing.output_per_1m;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

// ─── Post-call logging ────────────────────────────────────────────────────────

async function logUsage(
  userId: string,
  service: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  inputCost: number,
  outputCost: number,
  totalCost: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const { error: insertError } = await supabase.from('llm_usage_events').insert({
      user_id: userId,
      service,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
      metadata: metadata ?? null,
    });

    if (insertError) {
      console.error('[anthropic-client] Failed to insert llm_usage_events row:', insertError);
    }

    const { error: rpcError } = await supabase.rpc('increment_user_credits', {
      p_user_id: userId,
      p_amount: totalCost,
    });

    if (rpcError) {
      console.error('[anthropic-client] Failed to call increment_user_credits RPC:', rpcError);
    }
  } catch (err) {
    console.error('[anthropic-client] Unexpected error during usage logging:', err);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createAnthropicClient(options: AnthropicClientOptions): TrackedAnthropicMessages {
  const { userId, service } = options;
  const anthropic = new Anthropic();

  return {
    async create(params: TrackedMessageCreateParams): Promise<Message> {
      // Pull metadata out before passing to the SDK (it doesn't know about this field)
      const { metadata, ...sdkParams } = params;

      const { llmPricing, tierLimits, defaultModel } = await getConfig();

      // Use caller-supplied model if given, otherwise fall back to configured default
      const model = sdkParams.model ?? defaultModel;
      const finalParams: MessageCreateParamsNonStreaming = {
        ...sdkParams,
        model,
        stream: false,
      };

      await checkCreditLimit(userId, tierLimits);

      const response = await anthropic.messages.create(finalParams);

      // Fire-and-forget usage logging — must never throw to the caller
      const { inputTokens, outputTokens } = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
      const { inputCost, outputCost, totalCost } = calculateCost(
        model,
        inputTokens,
        outputTokens,
        llmPricing,
      );

      void logUsage(userId, service, model, inputTokens, outputTokens, inputCost, outputCost, totalCost, metadata);

      return response;
    },
  };
}
