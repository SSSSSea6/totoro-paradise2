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
  return pem.replace(/\\n/g, '\n').trim();
};

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const pem = buildPrivateKeyPem();
  const rsa = new NodeRSA(pem, 'pkcs8-private-pem', { environment: 'node' });
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const decrypted = rsa.decrypt(Buffer.from(req, 'base64'), 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
