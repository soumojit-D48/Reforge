import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FailureSource,
  type FailureCategory,
  type FailureSource as FailureSourceType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateFailureTagDto } from './dto/create-failure-tag.dto.js';
import { UpdateFailureTagDto } from './dto/update-failure-tag.dto.js';

export interface FailureTagView {
  id: string;
  traceId: string;
  category: FailureCategory;
  confidence: number | null;
  source: FailureSourceType;
  note: string | null;
  createdAt: string;
}

function toView(tag: {
  id: string;
  traceId: string;
  category: FailureCategory;
  confidence: number | null;
  source: FailureSourceType;
  note: string | null;
  createdAt: Date;
}): FailureTagView {
  return { ...tag, createdAt: tag.createdAt.toISOString() };
}

@Injectable()
export class FailureTagsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    traceId: string,
    dto: CreateFailureTagDto,
  ): Promise<FailureTagView> {
    await this.assertTraceExists(traceId);
    const tag = await this.prisma.failureTag.create({
      data: {
        traceId,
        category: dto.category,
        note: dto.note?.trim() || null,
        source: FailureSource.human,
      },
    });
    return toView(tag);
  }

  async update(
    traceId: string,
    tagId: string,
    dto: UpdateFailureTagDto,
  ): Promise<FailureTagView> {
    const tag = await this.prisma.failureTag.findFirst({
      where: { id: tagId, traceId },
    });
    if (tag === null) {
      throw new NotFoundException('Failure tag not found');
    }
    if (tag.source !== FailureSource.human) {
      throw new ConflictException('AI failure tags cannot be edited');
    }
    const updated = await this.prisma.failureTag.update({
      where: { id: tag.id },
      data: {
        ...(dto.category === undefined ? {} : { category: dto.category }),
        ...(dto.note === undefined
          ? {}
          : { note: dto.note === null ? null : dto.note.trim() || null }),
      },
    });
    return toView(updated);
  }

  private async assertTraceExists(traceId: string): Promise<void> {
    const trace = await this.prisma.trace.findUnique({
      where: { id: traceId },
      select: { id: true },
    });
    if (trace === null) {
      throw new NotFoundException('Trace not found');
    }
  }
}
