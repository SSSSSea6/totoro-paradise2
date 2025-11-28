export default interface SubmitMornSignRequest {
  stuNumber: string;
  phoneNumber?: string;
  qrCode?: string;
  headImage?: string;
  baseStation?: string;
  longitude: string;
  latitude: string;
  phoneInfo?: string;
  mac?: string;
  taskId: string;
  pointId: string;
  appVersion?: string;
  signType?: string;
  token: string;
  faceData?: string;
}
