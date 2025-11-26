import encryptServer from './encryptRequestContent.server';
import encryptClient from './encryptRequestContent.client';

const encryptRequestContent = (req: Record<string, any>): string => {
  // 在服务端使用 Node 内置 crypto 实现，在客户端使用 NodeRSA 实现
  if (process.server) {
    return encryptServer(req);
  }
  return encryptClient(req);
};

export default encryptRequestContent;
