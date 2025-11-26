import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const rsa = new NodeRSA(rsaKeys.privateKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const cipherBuffer = Buffer.from(req, 'base64');
  const decrypted = rsa.decrypt(cipherBuffer, 'utf8');
  return JSON.parse(decrypted);
};

export default decryptRequestContent;
