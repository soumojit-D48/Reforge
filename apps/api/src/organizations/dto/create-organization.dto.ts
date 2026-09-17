import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Robotics' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}
