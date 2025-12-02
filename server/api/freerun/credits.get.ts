import { getQuery } from 'h3';
import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置', credits: null, records: [] };
  }

  const query = getQuery(event);
  const userId = String(query.userId || '');
  if (!userId) {
    return { success: false, message: '缺少 userId', credits: null, records: [] };
  }

  const supabase = getSupabaseAdminClient();

  const { data: creditRow, error: creditError } = await supabase
    .from('free_run_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (creditError && creditError.code !== 'PGRST116') {
    return { success: false, message: creditError.message, credits: null, records: [] };
  }

  // 首次进入：无记录时自动创建，初始公里数为 1
  if (creditError?.code === 'PGRST116' || creditRow == null) {
    const { data: inserted, error: upsertError } = await supabase
      .from('free_run_credits')
      .upsert({
        user_id: userId,
        credits: 1,
        updated_at: new Date().toISOString(),
      })
      .select('credits')
      .single();

    if (upsertError) {
      return { success: false, message: upsertError.message, credits: null, records: [] };
    }

    return { success: true, credits: inserted?.credits ?? 1, records: [] };
  }

  const credits = creditRow?.credits ?? 0;

  const { data: records, error: recError } = await supabase
    .from('free_run_records')
    .select('distance_km, scantron_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recError && recError.code !== 'PGRST116') {
    return { success: false, message: recError.message, credits, records: [] };
  }

  return { success: true, credits, records: records || [] };
});
