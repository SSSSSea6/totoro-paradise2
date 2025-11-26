import crypto from 'crypto';
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
  const keyPem = buildPrivateKeyPem();
  const decrypted = crypto.privateDecrypt(
    {
      key: keyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    Buffer.from(req, 'base64'),
  );
  return JSON.parse(decrypted.toString('utf8'));
};

export default decryptRequestContent;
