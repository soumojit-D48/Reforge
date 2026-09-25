import { EvaluatorType } from '@prisma/client';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateRegressionTestDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  sourceTraceId?: string;

  @IsOptional()
  @IsString()
  expectedBehavior?: string;

  @IsOptional()
  @IsEnum(EvaluatorType)
  evaluatorType?: EvaluatorType;

  @IsOptional()
  @IsObject()
  evaluatorConfig?: Record<string, unknown>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minScore?: number;

  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  environment?: string;
}
