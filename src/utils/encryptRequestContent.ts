import rsaKeys from '../data/rsaKeys';
import NodeRSA from './nodeRSA';

const encryptRequestContent = (req: Record<string, any>): string => {
  const rsa = new NodeRSA(rsaKeys.privateKey);
  rsa.setOptions({ encryptionScheme: 'pkcs1' });
  const reqStr = JSON.stringify(req);
  // NodeRSA needs a Buffer in some runtimes; wrap the JSON string explicitly.
  return rsa.encrypt(Buffer.from(reqStr, 'utf-8'), 'base64');
};

export default encryptRequestContent;
