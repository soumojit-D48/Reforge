import { ApiProperty } from '@nestjs/swagger';
import { ReplayFieldType } from '@prisma/client';
import { IsDefined, IsEnum, IsObject } from 'class-validator';

export const REPLAY_RESOLUTION_VALUES = [
  'changed',
  'reused',
  'mocked',
  'fresh',
] as const;

export type ReplayResolutionValue = (typeof REPLAY_RESOLUTION_VALUES)[number];

export type ReplayResolutionInput = Record<string, unknown>;

export class CreateReplayDto {
  @ApiProperty({ enum: ReplayFieldType })
  @IsEnum(ReplayFieldType)
  changedField!: ReplayFieldType;

  @ApiProperty({ description: 'Replacement value for the changed field' })
  @IsDefined()
  changedValue!: unknown;

  @ApiProperty({
    example: {
      prompt: 'reused',
      tool_arguments: 'reused',
      retrieval: 'mocked',
      tool_response: 'mocked',
      model: 'changed',
      temperature: 'reused',
    },
  })
  @IsObject()
  fieldResolution!: ReplayResolutionInput;
}
