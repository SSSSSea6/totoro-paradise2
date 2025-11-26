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
  const buf = Buffer.isBuffer(pem) ? (pem as unknown as NodeBuffer) : NodeBuffer.from(pem, 'utf-8');
  if (process.env.KEY_DEBUG === '1') {
    console.log('[key-debug][decrypt]', { source, isBuffer: Buffer.isBuffer(buf), length: buf.length });
  }
  return { buf, source };
};

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const { buf: keyBuf } = buildPrivateKeyBuffer();
  const rsa = new NodeRSA(undefined, undefined, { environment: 'node' });
  try {
    rsa.importKey(keyBuf, 'pkcs8-private-pem');
  } catch (err) {
    console.error('[decryptRequestContent] importKey failed', err);
    throw err;
  }
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipherBuffer = NodeBuffer.from(req, 'base64');
  const decrypted = rsa.decrypt(cipherBuffer, 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
