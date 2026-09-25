import { EvaluatorType } from '@prisma/client';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateRegressionTestDto {
  @IsString()
  name!: string;

  @IsString()
  sourceTraceId!: string;

  @IsString()
  expectedBehavior!: string;

  @IsEnum(EvaluatorType)
  evaluatorType!: EvaluatorType;

  @IsOptional()
  @IsObject()
  evaluatorConfig?: Record<string, unknown>;

  @IsNumber()
  @Min(0)
  @Max(1)
  minScore!: number;

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
