import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpdateEvaluationOverrideDto {
  @ApiProperty({ minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  score!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reason!: string;
}
