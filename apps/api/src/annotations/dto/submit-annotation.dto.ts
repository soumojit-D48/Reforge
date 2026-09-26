import { AnnotationVerdict } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitAnnotationDto {
  @IsEnum(AnnotationVerdict)
  verdict!: AnnotationVerdict;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
