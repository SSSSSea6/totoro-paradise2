import type BaseResponse from "./BaseResponse";

export interface SunRunRecord {
  scoreId: string;
  mileage: string;
  usedTime: string;
  runTime: string; // 完成时间 yyyy-MM-dd HH:mm:ss
  consume: string;
  status: string;
  month: string;
  day: string;
  runType: string;
  flag: string;
}

export default interface SunRunSportResponse extends BaseResponse {
  runList: SunRunRecord[];
}
