import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

const WINDOW_START_MIN = 6 * 60 + 35; // 06:35
const WINDOW_END_MIN = 8 * 60 + 25; // 08:25

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

const pickSchedule = (userId: string): string => {
  const now = new Date();
  const nowMinutes = minutesOfDay(now);

  let targetDate = new Date(now);
  let start = WINDOW_START_MIN;
  let end = WINDOW_END_MIN;

  if (nowMinutes >= WINDOW_END_MIN) {
    // 已过窗口，安排到下一天窗口
    targetDate.setDate(targetDate.getDate() + 1);
  } else if (nowMinutes >= WINDOW_START_MIN) {
    // 窗口内，起始为当前分钟+1
    start = Math.max(nowMinutes + 1, WINDOW_START_MIN);
  } else {
    // 窗口未开始，保持今日窗口
  }

  // 随机分钟，尽量分散
  const span = end - start;
  const rnd = Math.random();
  const offset = Math.floor(rnd * span);
  const chosenMinutes = start + offset;

  targetDate.setHours(0, 0, 0, 0);
  targetDate.setMinutes(chosenMinutes);

  return targetDate.toISOString();
};

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { token, userId, signPoint, deviceInfo } = body || {};

  if (!token || !userId || !signPoint) {
    return { success: false, message: '缺少必要参数' };
  }

  const supabase = getSupabaseAdminClient();

  // 统一在服务端生成预约时间，窗口 06:35~08:25 且仅允许当前/未来时间
  const scheduledTime = pickSchedule(userId);

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

  return { success: true, message: '预约成功', scheduledTime };
});
