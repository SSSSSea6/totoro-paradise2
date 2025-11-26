import { Buffer as NodeBuffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const buildPrivateKeyBuffer = (): NodeBuffer => {
  // 优先使用环境变量，便于线上热修复；否则使用内置密钥
  const envB64 = process.env.PRIVATE_KEY_BASE64;
  const envPem = process.env.PRIVATE_KEY;
  let pem = '';
  if (envB64) {
    pem = NodeBuffer.from(envB64, 'base64').toString('utf-8');
  } else if (envPem) {
    pem = envPem;
  } else {
    pem = rsaKeys.privateKey;
  }
  // 修复被转义的换行
  pem = pem.replace(/\\n/g, '\n').trim();
  return NodeBuffer.from(pem, 'utf-8');
};

const encryptRequestContent = (req: Record<string, any>): string => {
  const keyBuf = buildPrivateKeyBuffer();
  const rsa = new NodeRSA(keyBuf, 'pkcs8-private-pem', { environment: 'node' });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  return rsa.encrypt(reqStr, 'base64');
};

export default encryptRequestContent;
