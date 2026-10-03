import { io, type Socket } from 'socket.io-client';

const SOCKET_URL =
  process.env.NEXT_PUBLIC_WS_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://localhost:3001';

export function createProjectSocket(
  token: string,
  projectId: string,
): Socket {
  return io(SOCKET_URL, {
    auth: { token, projectId },
    transports: ['websocket', 'polling'],
  });
}
