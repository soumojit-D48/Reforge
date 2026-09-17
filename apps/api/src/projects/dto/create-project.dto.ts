import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Support Bot' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
