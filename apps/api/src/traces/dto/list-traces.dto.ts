import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { SpanType, TraceStatus } from '@prisma/client';

function parseLimit(value: unknown): unknown {
  if (typeof value !== 'string' && typeof value !== 'number') {
    return value;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : value;
}

export class ListTracesDto {
  @IsOptional()
  @IsEnum(TraceStatus)
  status?: TraceStatus;

  @IsOptional()
  @IsString()
  environment?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsEnum(SpanType)
  errorType?: SpanType;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => parseLimit(value))
  @IsInt()
  @Min(1)
  // Values above the API maximum are accepted and capped by the service so
  // clients can safely request a larger page without a validation failure.
  @Max(1000)
  limit = 20;
}
