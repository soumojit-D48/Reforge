import { ApiProperty } from '@nestjs/swagger';
import { ReplayOutcome } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateReplayOutcomeDto {
  @ApiProperty({ enum: ReplayOutcome })
  @IsEnum(ReplayOutcome)
  outcome!: ReplayOutcome;
}
