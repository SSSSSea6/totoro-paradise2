import { format, intervalToDuration } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import type SunRunExercisesRequest from '../types/requestTypes/SunRunExercisesRequest';
import calCalculator from '../utils/calCalculator';
import generateMac from '../utils/generateMac';
import normalRandom from '../utils/normalRandom';
import timeUtil from '../utils/timeUtil';

/**
 * @param minTime 最短用时，以分钟计
 *  @param maxTime 最长用时，以分钟计
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
}) => {
  const { minSecond, maxSecond } = {
    minSecond: Number(minTime) * 60,
    maxSecond: Number(maxTime) * 60,
  };
  const avgSecond = minSecond + maxSecond / 2;
  const waitSecond = Math.floor(
    normalRandom(minSecond + maxSecond / 2, (maxSecond - avgSecond) / 3),
  );
  const startTime = new Date();
  const endTime = new Date(Number(startTime) + waitSecond * 1000);

  // ← 修改：随机增加 0.01-0.15 km
  const originalDistanceNum = Number(distance);  // 原里程，如 3.20
  const randomIncrement = Math.random() * 0.05 + 0.01;  // 0.01 到 0.15
  const adjustedDistanceNum = originalDistanceNum + randomIncrement;
  const adjustedDistance = adjustedDistanceNum.toFixed(2);  // 如 "3.25"

  const avgSpeed = (adjustedDistanceNum / (waitSecond / 3600)).toFixed(2);  // 更新速度基于新里程
  const duration = intervalToDuration({ start: startTime, end: endTime });
  const mac = await generateMac(stuNumber);
  const req: SunRunExercisesRequest = {
    LocalSubmitReason: '',
    avgSpeed,
    baseStation: '',
    endTime: format(endTime, 'HH:mm:ss'),
    evaluateDate: format(endTime, 'yyyy-MM-dd HH:mm:ss'),
    fitDegree: '1',
    flag: '1',
    headImage: '',
    ifLocalSubmit: '0',
    km: adjustedDistance,  // ← 更新为新里程
    mac,
    phoneInfo: '$CN11/iPhone15,4/17.4.1',
    phoneNumber: '',
    pointList: '',
    routeId,
    runType: '0',
    sensorString: '',
    startTime: format(startTime, 'HH:mm:ss'),
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
  return { req, endTime, adjustedDistance };  // ← 返回新里程，用于路径生成
};

export default generateRunReq;
