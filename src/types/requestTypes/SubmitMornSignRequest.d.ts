import type BasicRequest from './BasicRequest';

export default interface SubmitMornSignRequest extends BasicRequest {
  phoneNumber?: string;
  latitude: string;
  longitude: string;
  taskId: string;
  pointId: string;
  qrCode?: string;
  deviceType?: string;
  headImage?: string;
  baseStation?: string;
  phoneInfo?: string;
  mac?: string;
  appVersion?: string;
  signType?: string;
  faceData?: string;
}
