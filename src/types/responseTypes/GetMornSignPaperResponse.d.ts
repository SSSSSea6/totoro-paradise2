import type BaseResponse from './BaseResponse';
import type MornSignPoint from '../MornSignPoint';

export default interface GetMornSignPaperResponse extends BaseResponse {
  signType: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  offsetRange: string;
  dayNeedSignCount: string;
  dayCompSignCount: string;
  minTimeInterval: string;
  qrCode?: string;
  signPointList: MornSignPoint[];
}
