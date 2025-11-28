import type BaseResponse from './BaseResponse';
import type MorningScore from '../MorningScore';

export default interface GetMornSignArchDetailResponse extends BaseResponse {
  completedTimes?: string;
  incompleteTimes?: string;
  requireNumber?: string;
  ifDayHasComSign?: string;
  scoreList?: MorningScore[];
}
