import { Buffer as NodeBuffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

type KeySource = 'env-b64' | 'env-pem' | 'local';

const buildPrivateKeyBuffer = (): { buf: NodeBuffer; source: KeySource } => {
  const envB64 = process.env.PRIVATE_KEY_BASE64;
  const envPem = process.env.PRIVATE_KEY;
  let pem = '';
  let source: KeySource = 'local';
  if (envB64) {
    pem = NodeBuffer.from(envB64, 'base64').toString('utf-8');
    source = 'env-b64';
  } else if (envPem) {
    pem = envPem;
    source = 'env-pem';
  } else {
    pem = rsaKeys.privateKey;
    source = 'local';
  }
  pem = pem.replace(/\\n/g, '\n').trim();
  // 提取 PEM 主体转 DER，避免不同 Buffer polyfill 不兼容
  const body = pem.replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  const buf = NodeBuffer.from(body, 'base64');
  if (process.env.KEY_DEBUG === '1') {
    console.log('[key-debug][encrypt]', { source, isBuffer: Buffer.isBuffer(buf), length: buf.length });
  }
  return { buf, source };
};

const encryptRequestContent = (req: Record<string, any>): string => {
  const { buf: keyBuf } = buildPrivateKeyBuffer();
  // 构造后再导入，避免构造函数自动检测失败
  const rsa = new NodeRSA(undefined, undefined, { environment: 'node' });
  try {
    rsa.importKey(keyBuf, 'pkcs8-private-der');
  } catch (err) {
    console.error('[encryptRequestContent] importKey failed', err);
    throw err;
  }
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  return rsa.encrypt(reqStr, 'base64');
};

export default encryptRequestContent;
