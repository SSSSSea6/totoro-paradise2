import { Buffer } from 'buffer';
import NodeRSA from './nodeRSA';
import rsaKeys from '../data/rsaKeys';

const buildPrivateKeyPem = (): string => {
  const envB64 = process.env.PRIVATE_KEY_BASE64;
  const envPem = process.env.PRIVATE_KEY;
  let pem = '';
  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
  } else if (envPem) {
    pem = envPem;
  } else {
    pem = rsaKeys.privateKey;
  }
  // 修复转义换行并裁剪空白
  return pem.replace(/\\n/g, '\n').trim();
};

const encryptRequestContent = (req: Record<string, any>): string => {
  const pem = buildPrivateKeyPem();
  const keyBuf = Buffer.from(pem, 'utf-8');
  if (process.env.KEY_DEBUG === '1') {
    console.log('[key-debug][encrypt]', { isBuffer: Buffer.isBuffer(keyBuf), length: keyBuf.length });
  }
  const rsa = new NodeRSA(keyBuf, 'pkcs8-private-pem', { environment: 'node' });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  return rsa.encrypt(Buffer.from(reqStr, 'utf-8'), 'base64');
};

export default encryptRequestContent;
