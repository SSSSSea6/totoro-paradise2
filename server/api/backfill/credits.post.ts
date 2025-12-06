import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

const INITIAL_BONUS = 1; // 新用户首次查询自动赠送 1 次

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { action, userId, code } = body || {};

  if (!userId) {
    return { success: false, message: '缺少 userId' };
  }

  const supabase = getSupabaseAdminClient();

  if (action === 'get') {
    const { data, error } = await supabase
      .from('backfill_run_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      return { success: false, message: error.message };
    }

    if (error?.code === 'PGRST116' || !data) {
      const { data: inserted, error: upsertError } = await supabase
        .from('backfill_run_credits')
        .upsert({
          user_id: userId,
          credits: INITIAL_BONUS,
          updated_at: new Date().toISOString(),
        })
        .select('credits')
        .single();

      if (upsertError) {
        return { success: false, message: upsertError.message };
      }

      return { success: true, credits: inserted?.credits ?? INITIAL_BONUS };
    }

    return { success: true, credits: data?.credits ?? 0 };
  }

  if (action === 'redeem') {
    if (!code) {
      return { success: false, message: '缺少兑换码' };
    }

    const { data: codeData, error: codeError } = await supabase
      .from('backfill_redeem_codes')
      .select('code, amount, is_used, used_by, used_at')
      .eq('code', code)
      .eq('is_used', false)
      .single();

    if (codeError || !codeData) {
      return { success: false, message: '兑换码无效或已使用' };
    }

    const { error: markError } = await supabase
      .from('backfill_redeem_codes')
      .update({ is_used: true, used_by: userId, used_at: new Date().toISOString() })
      .eq('code', code);

    if (markError) {
      return { success: false, message: '兑换失败，请重试' };
    }

    const { data: userData, error: userError } = await supabase
      .from('backfill_run_credits')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      return { success: false, message: userError.message };
    }

    const currentCredits = userData?.credits ?? INITIAL_BONUS;
    const newCredits = currentCredits + (codeData.amount ?? 1);

    const { error: upsertError } = await supabase
      .from('backfill_run_credits')
      .upsert({ user_id: userId, credits: newCredits, updated_at: new Date().toISOString() });

    if (upsertError) {
      return { success: false, message: '兑换失败，请稍后重试' };
    }

    return { success: true, message: `成功兑换 ${codeData.amount ?? 1} 次`, credits: newCredits };
  }

  return { success: false, message: '未知操作' };
});
