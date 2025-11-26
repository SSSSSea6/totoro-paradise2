import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const decryptRequestContent = (req: string): Record<string, unknown> => {
  // Ensure the key is a Buffer to avoid import errors in some environments.
  const rsa = new NodeRSA(Buffer.from(rsaKeys.privateKey));
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipherBuffer = Buffer.from(req, 'base64');
  const decrypted = rsa.decrypt(cipherBuffer, 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
