import { ApiPropertyOptional } from '@nestjs/swagger';
import { FailureCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFailureTagDto {
  @ApiPropertyOptional({ enum: FailureCategory })
  @IsOptional()
  @IsEnum(FailureCategory)
  category?: FailureCategory;

  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string | null;
}
