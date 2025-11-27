import { createHash } from 'crypto';
import TotoroApiWrapper from '~~/src/wrappers/TotoroApiWrapper';
import type MornSignPoint from '~~/src/types/MornSignPoint';
import type SubmitMornSignRequest from '~~/src/types/requestTypes/SubmitMornSignRequest';
import type SubmitMorningExercisesResponse from '~~/src/types/responseTypes/SubmitMorningExercisesResponse';
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabaseAdminClient';

type MorningTaskRow = {
  id: number;
  user_id: string;
  token: string;
  device_info?: Record<string, any> | null;
  sign_point?: Record<string, any> | null;
  scheduled_time: string;
  status: string;
};

type ProcessResult = {
  processed: number;
  success: number;
  failed: number;
};

const isSuccessfulResponse = (res?: SubmitMorningExercisesResponse | null) => {
  if (!res) return false;
  // 仅当状态码和返回码都符合预期时才认为成功
  return res.status === '00' && res.code === '0';
};

const maskToken = (token?: string | null) => {
  if (!token) return token;
  if (token.length <= 10) return '***';
  return `${token.slice(0, 4)}***${token.slice(-4)}`;
};

const pseudoRandomFromHash = (hex: string, offset = 0) => {
  const slice = hex.slice(offset, offset + 8) || '0';
  const val = parseInt(slice, 16);
  return (val / 0xffffffff) * 2 - 1; // [-1, 1]
};

const jitterLocation = (point: Partial<MornSignPoint>, hexSeed: string) => {
  const lat = Number(point.latitude);
  const lng = Number(point.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return { lat, lng };
  const maxMeters = 8; // 控制在几米范围内抖动
  const degLat = maxMeters / 111000;
  const degLng = maxMeters / (111000 * Math.cos((lat * Math.PI) / 180) || 1);
  const randLat = pseudoRandomFromHash(hexSeed, 0);
  const randLng = pseudoRandomFromHash(hexSeed, 8);
  return {
    lat: lat + randLat * degLat,
    lng: lng + randLng * degLng,
  };
};

const generateFakeDeviceInfo = (deviceInfo: Record<string, any>, userId: string) => {
  // 伪造接近真机的指纹字段，尽量符合官方参数格式
  const hex = createHash('sha256').update(userId || 'anon').digest('hex');
  const imei =
    deviceInfo.imei ||
    hex
      .replace(/[a-f]/gi, (ch) => (parseInt(ch, 16) % 10).toString())
      .slice(0, 15)
      .padEnd(15, '0');
  const brand = deviceInfo.brand || 'HUAWEI';
  const model = deviceInfo.model || 'ALP-AL00';
  const androidVersion = deviceInfo.androidVersion || '13';
  const mac =
    deviceInfo.mac ||
    hex
      .slice(0, 12)
      .match(/.{1,2}/g)
      ?.join(':')
      .toUpperCase() ||
    '';
  const lac = deviceInfo.lac || (parseInt(hex.slice(12, 16), 16) % 60000).toString();
  const cid = deviceInfo.cid || (parseInt(hex.slice(16, 20), 16) % 60000).toString();
  const mcc = deviceInfo.mcc || '460';
  const mnc = deviceInfo.mnc || '00';
  const baseStation = deviceInfo.baseStation || `${mcc}|${mnc}|${lac}|${cid}`;
  return {
    phoneInfo: deviceInfo.phoneInfo || `CN001/${imei}/${brand}/${model}/${androidVersion}`,
    baseStation,
    mac,
    appVersion: deviceInfo.appVersion || '1.2.14',
    deviceType: deviceInfo.deviceType || '2',
    headImage: deviceInfo.headImage || '',
  };
};

const buildRequestFromTask = (task: MorningTaskRow): SubmitMornSignRequest => {
  const point = (task.sign_point || {}) as Partial<MornSignPoint>;
  const deviceInfo = (task.device_info || {}) as Record<string, any>;

  if (!point.taskId || !point.pointId) {
    throw new Error('Missing sign point information on task.');
  }

  const fake = generateFakeDeviceInfo(deviceInfo, task.user_id);
  const seedHex = createHash('md5').update(task.user_id || '').digest('hex');
  const { lat, lng } = jitterLocation(point, seedHex);

  return {
    token: task.token,
    campusId: deviceInfo.campusId ?? '',
    schoolId: deviceInfo.schoolId ?? '',
    stuNumber: task.user_id,
    phoneNumber: deviceInfo.phoneNumber || '',
    latitude: String(deviceInfo.latitude ?? lat ?? point.latitude ?? ''),
    longitude: String(deviceInfo.longitude ?? lng ?? point.longitude ?? ''),
    taskId: String(point.taskId ?? ''),
    pointId: String(point.pointId ?? ''),
    qrCode: point.qrCode,
    deviceType: fake.deviceType,
    headImage: fake.headImage,
    baseStation: fake.baseStation,
    phoneInfo: fake.phoneInfo,
    mac: fake.mac,
    appVersion: fake.appVersion,
    signType: (point as any).signType || deviceInfo.signType || '0',
  };
};

export const runDueMorningTasks = async (limit = 100): Promise<ProcessResult> => {
  if (!isSupabaseConfigured()) {
    return { processed: 0, success: 0, failed: 0 };
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data: tasks, error } = await supabase
    .from('morning_sign_tasks')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_time', nowIso)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to fetch morning tasks: ${error.message}`);
  }

  let success = 0;
  let failed = 0;

  for (const task of tasks || []) {
    let resultLog = '';
    let status: 'success' | 'failed' = 'success';

    try {
      const req = buildRequestFromTask(task as MorningTaskRow);
      const res = await TotoroApiWrapper.submitMorningExercises(req);
      const ok = isSuccessfulResponse(res);
      status = ok ? 'success' : 'failed';
      resultLog = JSON.stringify({
        refreshed: false,
        usedLatestPoint: false,
        pointId: req.pointId,
        maskedToken: maskToken((task as MorningTaskRow).token),
        req,
        res,
      });
    } catch (err) {
      status = 'failed';
      const error = err as Error;
      resultLog = JSON.stringify({
        maskedToken: maskToken((task as MorningTaskRow).token),
        error: error.stack || error.message,
        task,
      });
      console.error('[morning-scheduler] task failed', {
        taskId: (task as MorningTaskRow).id,
        message: error.message,
        stack: error.stack,
      });
    }

    const { error: updateError } = await supabase
      .from('morning_sign_tasks')
      .update({ status, result_log: resultLog })
      .eq('id', (task as MorningTaskRow).id);

    if (updateError) {
      console.error('[morning-scheduler] failed to update task status', updateError);
    }

    if (status === 'success') success += 1;
    else failed += 1;
  }

  return { processed: (tasks || []).length, success, failed };
};
