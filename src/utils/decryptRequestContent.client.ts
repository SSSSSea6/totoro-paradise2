import NodeRSA from './nodeRSA';
import rsaKeys from '../data/rsaKeys';

const decryptRequestContent = (req: string): Record<string, unknown> => {
  const rsa = new NodeRSA(rsaKeys.privateKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  return JSON.parse(rsa.decrypt(req, 'utf8'));
};

export default decryptRequestContent;

