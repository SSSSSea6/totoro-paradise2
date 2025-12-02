import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { code, userId } = body || {};

  if (!code || !userId) {
    return { success: false, message: '缺少兑换码或 userId' };
  }

  const supabase = getSupabaseAdminClient();

  const { data: codeData, error: codeError } = await supabase
    .from('free_run_codes')
    .select('*')
    .eq('code', code)
    .eq('is_used', false)
    .single();

  if (codeError || !codeData) {
    return { success: false, message: '兑换码无效或已使用' };
  }

  const { data: creditRow, error: creditError } = await supabase
    .from('free_run_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (creditError && creditError.code !== 'PGRST116') {
    return { success: false, message: creditError.message };
  }

  const currentCredits = creditRow?.credits ?? 0;
  const newCredits = currentCredits + (codeData.amount || 0);

  const { error: upsertError } = await supabase
    .from('free_run_credits')
    .upsert({
      user_id: userId,
      credits: newCredits,
      updated_at: new Date().toISOString(),
    });

  if (upsertError) {
    return { success: false, message: '兑换失败，请稍后重试' };
  }

  const { error: markError } = await supabase
    .from('free_run_codes')
    .update({ is_used: true, used_by: userId, used_at: new Date().toISOString() })
    .eq('code', code);

  if (markError) {
    return { success: false, message: '兑换失败，请稍后重试' };
  }

  return { success: true, message: `成功兑换 ${codeData.amount} 次`, credits: newCredits };
});
