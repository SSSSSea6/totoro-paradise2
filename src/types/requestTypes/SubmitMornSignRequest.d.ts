import type BasicRequest from './BasicRequest';

export default interface SubmitMornSignRequest extends BasicRequest {
  latitude: string;
  longitude: string;
  taskId: string;
  pointId: string;
  qrCode?: string;
  deviceType?: string;
  phoneNumber?: string;
}
