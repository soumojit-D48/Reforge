import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidateNested,
} from 'class-validator';
import { SpanTreeConstraint } from './span-tree.constraint.js';
import { SpanDto } from './span.dto.js';

export const TRACE_STATUSES = ['running', 'success', 'failed'] as const;

export class IngestTraceDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Expose({ name: 'external_id' })
  externalId?: string;

  @ApiProperty({ example: 'customer-support-run' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ example: 'production', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  environment?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  input?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  metadata?: unknown;

  // Required whenever spans are present (ARCHITECTURE §4); enforced
  // together with optionality below: absent + spans → 400 in the service.
  @ApiProperty({ example: '2026-09-16T09:31:02.000Z', required: false })
  @IsOptional()
  @IsISO8601()
  @Expose({ name: 'started_at' })
  startedAt?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  @Expose({ name: 'ended_at' })
  endedAt?: string;

  @ApiProperty({ enum: TRACE_STATUSES })
  @IsString()
  @IsIn(TRACE_STATUSES as unknown as string[])
  status!: string;

  @ApiProperty({ type: [SpanDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpanDto)
  @Validate(SpanTreeConstraint)
  spans?: SpanDto[];
}
