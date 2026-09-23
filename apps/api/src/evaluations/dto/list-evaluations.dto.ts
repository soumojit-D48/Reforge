import { ApiProperty } from '@nestjs/swagger';
import { EvaluationTargetType } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class ListEvaluationsDto {
  @ApiProperty({ enum: EvaluationTargetType })
  @IsEnum(EvaluationTargetType)
  targetType!: EvaluationTargetType;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  targetId!: string;
}
