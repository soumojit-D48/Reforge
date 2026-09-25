import { IsOptional, IsString } from 'class-validator';

export class RunTestSuiteDto {
  @IsOptional()
  @IsString()
  promptVersion?: string;

  @IsOptional()
  @IsString()
  model?: string;
}
