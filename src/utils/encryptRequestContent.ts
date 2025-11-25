import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const encryptRequestContent = (req: Record<string, any>): string => {
  const rsa = new NodeRSA(rsaKeys.privateKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  // NodeRSA 在部分环境下要求明确传入 Buffer，这里统一用 Buffer 包装字符串
  return rsa.encrypt(Buffer.from(reqStr, 'utf-8'), 'base64');
};
export default encryptRequestContent;
