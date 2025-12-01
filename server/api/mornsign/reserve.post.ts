import { getSupabaseAdminClient, isSupabaseConfigured } from '../../utils/supabaseAdminClient';

const WINDOW_START_MIN = 6 * 60 + 35; // 06:35
const WINDOW_END_MIN = 8 * 60 + 25; // 08:25
const TZ_OFFSET_MS = 8 * 60 * 60 * 1000; // 北京时区相对 UTC 的偏移（+8h）

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();

// 返回本地（北京时间）预约时间的 Date 对象
const pickSchedule = (desiredDate?: string): Date => {
  const now = new Date();
  const nowMinutes = minutesOfDay(now);

  let targetDate = new Date(now);
  let start = WINDOW_START_MIN;
  let end = WINDOW_END_MIN;

  // 如果传入了日期，优先使用该日期（仅日期部分），小于今天则修正到今天
  if (desiredDate) {
    const parsed = new Date(desiredDate);
    if (!Number.isNaN(parsed.getTime())) {
      parsed.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (parsed < today) {
        targetDate = today;
      } else {
        targetDate = parsed;
      }
    }
  }

  const isTargetToday =
    targetDate.getFullYear() === now.getFullYear() &&
    targetDate.getMonth() === now.getMonth() &&
    targetDate.getDate() === now.getDate();

  if (isTargetToday) {
    if (nowMinutes >= WINDOW_END_MIN) {
      // 当天窗口已过，顺延到下一天窗口
      targetDate.setDate(targetDate.getDate() + 1);
    } else if (nowMinutes >= WINDOW_START_MIN) {
      // 当天窗口内，从当前分钟之后开始随机
      start = Math.max(nowMinutes + 1, WINDOW_START_MIN);
    } else {
      // 当天窗口未开始，使用默认窗口
    }
  } else {
    // 目标为未来日期，使用固定窗口
    start = WINDOW_START_MIN;
    end = WINDOW_END_MIN;
  }

  // 随机分钟，尽量分散
  const span = end - start;
  const rnd = Math.random();
  const offset = Math.floor(rnd * span);
  const chosenMinutes = start + offset;

  targetDate.setHours(0, 0, 0, 0);
  targetDate.setMinutes(chosenMinutes);

  return targetDate;
};

export default defineEventHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return { success: false, message: 'Supabase 未配置' };
  }

  const body = await readBody(event);
  const { token, userId, signPoint, deviceInfo, desiredDate } = body || {};

  if (!token || !userId || !signPoint) {
    return { success: false, message: '缺少必要参数' };
  }

  const supabase = getSupabaseAdminClient();

  // 生成北京时间预约时间
  const scheduledLocal = pickSchedule(desiredDate);
  // 转为 UTC 入库（北京时间 -8 小时）
  const scheduledUtc = new Date(scheduledLocal.getTime() - TZ_OFFSET_MS);

  // 同一天仅可预约一次（按北京时间判定）
  const startOfDayLocal = new Date(scheduledLocal);
  startOfDayLocal.setHours(0, 0, 0, 0);
  const endOfDayLocal = new Date(startOfDayLocal);
  endOfDayLocal.setHours(23, 59, 59, 999);

  const startOfDayUtc = new Date(startOfDayLocal.getTime() - TZ_OFFSET_MS);
  const endOfDayUtc = new Date(endOfDayLocal.getTime() - TZ_OFFSET_MS);

  const { data: existsTask, error: existsError } = await supabase
    .from('morning_sign_tasks')
    .select('id')
    .eq('user_id', userId)
    .gte('scheduled_time', startOfDayUtc.toISOString())
    .lte('scheduled_time', endOfDayUtc.toISOString())
    .limit(1)
    .maybeSingle();

  if (!existsError && existsTask) {
    return { success: false, message: '同一天只能预约一次' };
  }

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
    scheduled_time: scheduledUtc.toISOString(),
    status: 'pending',
  });

  if (insertError) {
    return { success: false, message: `预约失败: ${insertError.message}` };
  }

  return { success: true, message: '预约成功', scheduledTime: scheduledUtc.toISOString() };
});
