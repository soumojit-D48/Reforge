import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FailureCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFailureTagDto {
  @ApiProperty({ enum: FailureCategory })
  @IsEnum(FailureCategory)
  category!: FailureCategory;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
