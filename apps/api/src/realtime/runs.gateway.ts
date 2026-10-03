import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Socket, Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import {
  PROJECT_ROOM_PREFIX,
  REALTIME_EVENTS,
  type PresenceLeftPayload,
  type PresenceViewingPayload,
} from './realtime.constants.js';
import { RealtimeService } from './realtime.service.js';

interface SocketData {
  user: AuthenticatedUser;
  projectId?: string;
  viewedTraceId?: string;
}

interface ProjectRoomMessage {
  projectId: string;
}

interface TraceViewingMessage {
  traceId: string;
}

interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
@WebSocketGateway({ namespace: '/', transports: ['websocket', 'polling'] })
export class RunsGateway {
  @WebSocketServer()
  private server!: Server;

  private readonly viewersByTrace = new Map<string, Map<string, string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeService,
  ) {}

  afterInit(server: Server): void {
    this.server = server;
    this.realtime.attachServer(server);
    server.use((socket, next) => {
      void this.authenticateSocket(socket)
        .then(() => next())
        .catch((error: unknown) => {
          next(error instanceof Error ? error : new Error('Socket authentication failed'));
        });
    });
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const data = socket.data as SocketData;
      if (data.user === undefined) {
        data.user = await this.authenticate(socket);
      }
      const projectId = this.projectIdFromHandshake(socket);
      if (projectId !== null) {
        await this.joinProject(socket, projectId);
      }
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket): void {
    const data = socket.data as SocketData;
    if (data.viewedTraceId !== undefined) {
      const userId = this.removeViewer(data.viewedTraceId, socket.id);
      if (userId !== null && data.projectId !== undefined) {
        const payload: PresenceLeftPayload = {
          traceId: data.viewedTraceId,
          userId,
        };
        socket.to(this.projectRoom(data.projectId)).emit(
          REALTIME_EVENTS.presenceLeft,
          payload,
        );
      }
    }
  }

  @SubscribeMessage('project.join')
  async joinProjectMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: ProjectRoomMessage,
  ): Promise<{ joined: boolean }> {
    await this.joinProject(socket, body.projectId);
    return { joined: true };
  }

  @SubscribeMessage('project.leave')
  leaveProjectMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: ProjectRoomMessage,
  ): { left: boolean } {
    void socket.leave(this.projectRoom(body.projectId));
    const data = socket.data as SocketData;
    if (data.projectId === body.projectId) {
      data.projectId = undefined;
    }
    return { left: true };
  }

  @SubscribeMessage('trace.viewing')
  async viewTrace(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: TraceViewingMessage,
  ): Promise<{ viewing: boolean; hasOtherViewer: boolean }> {
    const data = socket.data as SocketData;
    const trace = await this.prisma.trace.findUnique({
      where: { id: body.traceId },
      select: { projectId: true },
    });
    if (trace === null || data.user === undefined) {
      throw new ForbiddenException('No access to this trace');
    }
    await this.assertProjectAccess(data.user.userId, trace.projectId);
    await this.joinProject(socket, trace.projectId);

    if (data.viewedTraceId !== undefined && data.viewedTraceId !== body.traceId) {
      const previousTraceId = data.viewedTraceId;
      const userId = this.removeViewer(previousTraceId, socket.id);
      if (userId !== null) {
        socket.to(this.projectRoom(trace.projectId)).emit(
          REALTIME_EVENTS.presenceLeft,
          { traceId: previousTraceId, userId } satisfies PresenceLeftPayload,
        );
      }
    }
    data.viewedTraceId = body.traceId;
    const viewers = this.viewersByTrace.get(body.traceId) ?? new Map<string, string>();
    const existingUsers = [...viewers.entries()];
    viewers.set(socket.id, data.user.userId);
    this.viewersByTrace.set(body.traceId, viewers);
    if (viewers.size > 1) {
      for (const [, userId] of existingUsers) {
        socket.emit(REALTIME_EVENTS.presenceViewing, {
          traceId: body.traceId,
          userId,
        } satisfies PresenceViewingPayload);
      }
      socket.to(this.projectRoom(trace.projectId)).emit(REALTIME_EVENTS.presenceViewing, {
        traceId: body.traceId,
        userId: data.user.userId,
      } satisfies PresenceViewingPayload);
    }
    return { viewing: true, hasOtherViewer: existingUsers.length > 0 };
  }

  @SubscribeMessage('trace.viewing.stop')
  stopViewing(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: TraceViewingMessage,
  ): { stopped: boolean } {
    const data = socket.data as SocketData;
    if (data.viewedTraceId === body.traceId) {
      const userId = this.removeViewer(body.traceId, socket.id);
      if (userId !== null && data.projectId !== undefined) {
        socket.to(this.projectRoom(data.projectId)).emit(
          REALTIME_EVENTS.presenceLeft,
          { traceId: body.traceId, userId } satisfies PresenceLeftPayload,
        );
      }
      data.viewedTraceId = undefined;
    }
    return { stopped: true };
  }

  private async authenticate(socket: Socket): Promise<AuthenticatedUser> {
    const auth = socket.handshake.auth as { token?: unknown };
    const token = typeof auth.token === 'string' ? auth.token : this.authorizationToken(socket);
    if (token === null) {
      throw new UnauthorizedException('Authentication required');
    }
    const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_SECRET'),
    });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (user === null) {
      throw new UnauthorizedException('User no longer exists');
    }
    return { userId: user.id, email: user.email };
  }

  private async authenticateSocket(socket: Socket): Promise<void> {
    const user = await this.authenticate(socket);
    const data = socket.data as SocketData;
    data.user = user;
    const projectId = this.projectIdFromHandshake(socket);
    if (projectId !== null) {
      await this.assertProjectAccess(user.userId, projectId);
      data.projectId = projectId;
    }
  }

  private authorizationToken(socket: Socket): string | null {
    const header = socket.handshake.headers.authorization;
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
      return null;
    }
    return header.slice('Bearer '.length);
  }

  private projectIdFromHandshake(socket: Socket): string | null {
    const projectId = (socket.handshake.auth as { projectId?: unknown }).projectId;
    return typeof projectId === 'string' && projectId.length > 0 ? projectId : null;
  }

  private async joinProject(socket: Socket, projectId: string): Promise<void> {
    const data = socket.data as SocketData;
    if (data.user === undefined) {
      throw new UnauthorizedException('Authentication required');
    }
    await this.assertProjectAccess(data.user.userId, projectId);
    void socket.join(this.projectRoom(projectId));
    data.projectId = projectId;
  }

  private async assertProjectAccess(userId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (project === null) {
      throw new ForbiddenException('No access to this project');
    }
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
    });
    if (membership === null) {
      throw new ForbiddenException('No access to this project');
    }
  }

  private removeViewer(traceId: string, socketId: string): string | null {
    const viewers = this.viewersByTrace.get(traceId);
    if (viewers === undefined) {
      return null;
    }
    const userId = viewers.get(socketId) ?? null;
    viewers.delete(socketId);
    if (viewers.size === 0) {
      this.viewersByTrace.delete(traceId);
    }
    return userId;
  }

  private projectRoom(projectId: string): string {
    return `${PROJECT_ROOM_PREFIX}${projectId}`;
  }
}
