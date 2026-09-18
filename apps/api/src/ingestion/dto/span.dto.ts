import { ApiProperty } from '@nestjs/swagger';
import { SpanType } from '@prisma/client';
import { Expose, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Single source of truth: the Prisma enum. The wire schema accepts exactly
// the span types the database can store — no parallel list to drift.
export const SPAN_TYPES: string[] = Object.values(SpanType);

export class TokenUsageDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  prompt?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  completion?: number;
}

export class SpanDto {
  @ApiProperty({ example: 'span_1', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  id?: string;

  @ApiProperty({ example: 'span_2', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Expose({ name: 'parent_id' })
  parentId?: string;

  @ApiProperty({ enum: SPAN_TYPES })
  @IsString()
  @IsIn(SPAN_TYPES)
  type!: string;

  @ApiProperty({ example: 'getOrderStatus' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  model?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Expose({ name: 'prompt_version' })
  promptVersion?: string;

  // Free-form agent payloads — stored as Json (DATA_MODEL §1). Optional
  // and untyped by design; shape belongs to the wire schema, not columns.
  @ApiProperty({ required: false })
  @IsOptional()
  input?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  output?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  arguments?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  result?: unknown;

  @ApiProperty({ required: false })
  @IsOptional()
  error?: unknown;

  @ApiProperty({ required: false, type: TokenUsageDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TokenUsageDto)
  @Expose({ name: 'token_usage' })
  tokenUsage?: TokenUsageDto;

  @ApiProperty({ example: '2026-09-16T09:31:02.100Z' })
  @IsISO8601()
  @Expose({ name: 'started_at' })
  startedAt!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsISO8601()
  @Expose({ name: 'ended_at' })
  endedAt?: string;
}
