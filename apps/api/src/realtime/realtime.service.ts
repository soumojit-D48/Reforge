import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';
import {
  PROJECT_ROOM_PREFIX,
  type RealtimeEventName,
} from './realtime.constants.js';

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attachServer(server: Server): void {
    this.server = server;
  }

  emitToProject<T>(
    projectId: string,
    event: RealtimeEventName,
    payload: T,
  ): void {
    if (this.server === null) {
      this.logger.warn(`Dropped realtime event before gateway initialization: ${event}`);
      return;
    }
    this.server.to(this.projectRoom(projectId)).emit(event, payload);
  }

  projectRoom(projectId: string): string {
    return `${PROJECT_ROOM_PREFIX}${projectId}`;
  }
}
