import { Buffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

type KeySource = 'env-b64' | 'env-pem' | 'local';

const buildPrivateKeyPem = (): { pem: string; source: KeySource } => {
  const envB64 = process.env.PRIVATE_KEY_BASE64;
  const envPem = process.env.PRIVATE_KEY;
  let pem = '';
  let source: KeySource = 'local';
  if (envB64) {
    pem = Buffer.from(envB64, 'base64').toString('utf-8');
    source = 'env-b64';
  } else if (envPem) {
    pem = envPem;
    source = 'env-pem';
  } else {
    pem = rsaKeys.privateKey;
    source = 'local';
  }
  pem = pem.replace(/\\n/g, '\n').trim();
  if (process.env.KEY_DEBUG === '1') {
    console.log('[key-debug][decrypt]', {
      source,
      isBuffer: Buffer.isBuffer(pem),
      length: pem.length,
    });
  }
  return { pem, source };
};

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const { pem: keyPem } = buildPrivateKeyPem();
  const keyBuf = Buffer.from(keyPem, 'utf-8');
  const rsa = new NodeRSA(keyBuf, 'pkcs8-private-pem', { environment: 'node' });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const decrypted = rsa.decrypt(Buffer.from(req, 'base64'), 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
