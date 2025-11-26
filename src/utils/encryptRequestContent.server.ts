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

const encryptRequestContent = (req: Record<string, any>): string => {
  const keyPem = buildPrivateKeyPem();
  const buffer = Buffer.from(JSON.stringify(req), 'utf8');
  const encrypted = crypto.privateEncrypt(
    {
      key: keyPem,
      padding: crypto.constants.RSA_PKCS1_PADDING,
    },
    buffer,
  );
  return encrypted.toString('base64');
};

export default encryptRequestContent;
