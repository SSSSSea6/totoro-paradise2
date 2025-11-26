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
  const rsa = new NodeRSA(pem, 'pkcs8-private-pem', { environment: 'node' });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  return rsa.encrypt(Buffer.from(reqStr, 'utf-8'), 'base64');
};

export default encryptRequestContent;
