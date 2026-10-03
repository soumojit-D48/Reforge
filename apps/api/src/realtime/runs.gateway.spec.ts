import type { JwtService } from '@nestjs/jwt';
import type { ConfigService } from '@nestjs/config';
import type { Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service.js';
import { RealtimeService } from './realtime.service.js';
import { REALTIME_EVENTS } from './realtime.constants.js';
import { RunsGateway } from './runs.gateway.js';

function socket(id: string, userId: string): Socket {
  return {
    id,
    data: { user: { userId, email: `${userId}@example.com` } },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: vi.fn() })),
    handshake: { auth: {} },
  } as unknown as Socket;
}

function mockMethod(client: Socket, name: string): ReturnType<typeof vi.fn> {
  return (client as unknown as Record<string, ReturnType<typeof vi.fn>>)[name];
}

describe('RunsGateway', () => {
  it('joins authorized project rooms and broadcasts presence to both viewers', async () => {
    const prisma = {
      trace: {
        findUnique: vi.fn().mockResolvedValue({ projectId: 'project-1' }),
      },
      project: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue({ role: 'developer' }),
      },
    } as unknown as PrismaService;
    const realtime = new RealtimeService();
    const gateway = new RunsGateway(
      prisma,
      {} as JwtService,
      {} as ConfigService,
      realtime,
    );
    const first = socket('socket-1', 'user-1');
    const second = socket('socket-2', 'user-2');

    await gateway.viewTrace(first, { traceId: 'trace-1' });
    await gateway.viewTrace(second, { traceId: 'trace-1' });

    expect(mockMethod(first, 'join')).toHaveBeenCalledWith('project:project-1');
    expect(mockMethod(second, 'join')).toHaveBeenCalledWith('project:project-1');
    expect(mockMethod(second, 'emit')).toHaveBeenCalledWith(REALTIME_EVENTS.presenceViewing, {
      traceId: 'trace-1',
      userId: 'user-1',
    });
    const roomEmitter = (second.to as ReturnType<typeof vi.fn>).mock.results[0]?.value as {
      emit: ReturnType<typeof vi.fn>;
    };
    expect(roomEmitter.emit).toHaveBeenCalledWith(REALTIME_EVENTS.presenceViewing, {
      traceId: 'trace-1',
      userId: 'user-2',
    });
  });

  it('rejects a socket attempting to join a project without membership', async () => {
    const prisma = {
      project: {
        findUnique: vi.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
      organizationMember: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as PrismaService;
    const gateway = new RunsGateway(
      prisma,
      {} as JwtService,
      {} as ConfigService,
      new RealtimeService(),
    );
    const client = socket('socket-1', 'outsider');

    await expect(gateway.joinProjectMessage(client, { projectId: 'project-1' })).rejects.toThrow(
      'No access to this project',
    );
    expect(mockMethod(client, 'join')).not.toHaveBeenCalled();
  });
});
