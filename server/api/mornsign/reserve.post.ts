import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { token, userId, signPoint, scheduledTime, deviceInfo } = body || {};

  if (!token || !userId || !signPoint || !scheduledTime) {
    return { success: false, message: '缺少必要参数' };
  }

  const supabase = getSupabaseAdminClient();

  // 临时放开当天重复预约限制

  const { data: creditData, error: creditError } = await supabase
    .from('user_credits')
    .select('credits')
    .eq('user_id', userId)
    .single();

  if (creditError && creditError.code !== 'PGRST116') {
    return { success: false, message: '读取余额失败' };
  }

  const credits = creditData?.credits ?? 0;
  if (credits < 1) {
    return { success: false, message: '余额不足' };
  }

  const { error: deductError } = await supabase
    .from('user_credits')
    .update({ credits: credits - 1, updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (deductError) {
    return { success: false, message: '扣费失败，请重试' };
  }

  const { error: insertError } = await supabase.from('morning_sign_tasks').insert({
    user_id: userId,
    token,
    device_info: deviceInfo || null,
    sign_point: signPoint,
    scheduled_time: scheduledTime,
    status: 'pending',
  });

  if (insertError) {
    return { success: false, message: `预约失败: ${insertError.message}` };
  }

  return { success: true, message: '预约成功' };
});
