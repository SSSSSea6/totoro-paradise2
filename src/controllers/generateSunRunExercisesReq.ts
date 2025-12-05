import { format, intervalToDuration } from 'date-fns';
import type SunRunExercisesRequest from '../types/requestTypes/SunRunExercisesRequest';
import generateMac from '../utils/generateMac';
import normalRandom from '../utils/normalRandom';
import timeUtil from '../utils/timeUtil';

const BEIJING_OFFSET_MINUTES = 8 * 60;

const offsetDiffMs = () => {
  const currentOffsetMinutes = -new Date().getTimezoneOffset();
  return (BEIJING_OFFSET_MINUTES - currentOffsetMinutes) * 60_000;
};

const parseCustomEndTime = (customEndTime?: string | Date) => {
  if (!customEndTime) return null;
  if (customEndTime instanceof Date) return customEndTime;

  const normalized = customEndTime.trim().replace(' ', 'T');
  if (!normalized) return null;

  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  const withZone = /([+-]\d{2}:?\d{2}|Z)$/i.test(withSeconds)
    ? withSeconds
    : `${withSeconds}+08:00`;

  const parsed = new Date(withZone);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * @param minTime minimum duration in minutes
 * @param maxTime maximum duration in minutes
 */
const generateRunReq = async ({
  distance,
  routeId,
  taskId,
  token,
  schoolId,
  stuNumber,
  phoneNumber,
  minTime,
  maxTime,
  customEndTime,
}: {
  distance: string;
  routeId: string;
  taskId: string;
  token: string;
  schoolId: string;
  stuNumber: string;
  phoneNumber: string;
  minTime: string;
  maxTime: string;
  customEndTime?: string | Date;
}) => {
  const { minSecond, maxSecond } = {
    minSecond: Number(minTime) * 60,
    maxSecond: Number(maxTime) * 60,
  };
  const avgSecond = minSecond + maxSecond / 2;
  const waitSecond = Math.floor(
    normalRandom(minSecond + maxSecond / 2, (maxSecond - avgSecond) / 3),
  );

  const diffMs = offsetDiffMs();
  const now = new Date();
  const parsedCustomEnd = parseCustomEndTime(customEndTime);

  const defaultLocalStart = new Date(now.getTime() + diffMs);
  const defaultLocalEnd = new Date(now.getTime() + waitSecond * 1000 + diffMs);

  const localEnd = parsedCustomEnd
    ? new Date(parsedCustomEnd.getTime() + diffMs)
    : defaultLocalEnd;
  const localStart = parsedCustomEnd
    ? new Date(localEnd.getTime() - waitSecond * 1000)
    : defaultLocalStart;

  // Slight random distance bump (0.01~0.15km) to avoid exact repeats
  const originalDistanceNum = Number(distance);
  const randomIncrement = Math.random() * 0.05 + 0.01;
  const adjustedDistanceNum = originalDistanceNum + randomIncrement;
  const adjustedDistance = adjustedDistanceNum.toFixed(2);

  const avgSpeed = (adjustedDistanceNum / (waitSecond / 3600)).toFixed(2);
  const duration = intervalToDuration({ start: localStart, end: localEnd });
  const mac = await generateMac(stuNumber);
  const req: SunRunExercisesRequest = {
    LocalSubmitReason: '',
    avgSpeed,
    baseStation: '',
    endTime: format(localEnd, 'HH:mm:ss'),
    evaluateDate: format(localEnd, 'yyyy-MM-dd HH:mm:ss'),
    fitDegree: '1',
    flag: '1',
    headImage: '',
    ifLocalSubmit: '0',
    km: adjustedDistance,
    mac,
    phoneInfo: '$CN11/iPhone15,4/17.4.1',
    phoneNumber: '',
    pointList: '',
    routeId,
    runType: '0',
    sensorString: '',
    startTime: format(localStart, 'HH:mm:ss'),
    steps: `${1000 + Math.floor(Math.random() * 1000)}`,
    stuNumber,
    taskId,
    token,
    usedTime: timeUtil.getHHmmss(duration),
    version: '1.2.14',
    warnFlag: '0',
    warnType: '',
    faceData: '',
  };
  // endTime still uses the runtime duration so the UI progress bar stays reasonable
  return { req, endTime: new Date(Number(now) + waitSecond * 1000), adjustedDistance };
};

export default generateRunReq;
