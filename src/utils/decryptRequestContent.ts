import { Buffer as NodeBuffer } from 'buffer';
import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const buildPrivateKeyBuffer = (): NodeBuffer => {
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
  pem = pem.replace(/\\n/g, '\n').trim();
  return NodeBuffer.from(pem, 'utf-8');
};

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const keyBuf = buildPrivateKeyBuffer();
  const rsa = new NodeRSA(undefined, undefined, { environment: 'node' });
  rsa.importKey(keyBuf, 'pkcs8-private-pem');
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipherBuffer = NodeBuffer.from(req, 'base64');
  const decrypted = rsa.decrypt(cipherBuffer, 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
