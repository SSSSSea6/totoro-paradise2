import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type SupabaseEnv = {
  url?: string;
  serviceKey?: string;
};

const getSupabaseEnv = (): SupabaseEnv => ({
  url: process.env.SUPABASE_URL || process.env.NUXT_SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SERVICE_KEY || process.env.NUXT_SUPABASE_SERVICE_KEY,
});

let adminClient: SupabaseClient | null = null;

export const isSupabaseConfigured = () => {
  const { url, serviceKey } = getSupabaseEnv();
  return Boolean(url && serviceKey);
};

export const getSupabaseAdminClient = (): SupabaseClient => {
  if (adminClient) return adminClient;
  const { url, serviceKey } = getSupabaseEnv();
  if (!url || !serviceKey) {
    throw new Error('Supabase environment variables are missing.');
  }
  adminClient = createClient(url, serviceKey);
  return adminClient;
};
