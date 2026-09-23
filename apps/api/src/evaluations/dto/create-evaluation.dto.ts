import { ApiProperty } from '@nestjs/swagger';
import { EvaluationTargetType, EvaluatorType } from '@prisma/client';
import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateEvaluationDto {
  @ApiProperty({ enum: EvaluationTargetType })
  @IsEnum(EvaluationTargetType)
  targetType!: EvaluationTargetType;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  targetId!: string;

  @ApiProperty({ enum: EvaluatorType })
  @IsEnum(EvaluatorType)
  evaluatorType!: EvaluatorType;

  @ApiProperty({ required: false, type: Object })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
