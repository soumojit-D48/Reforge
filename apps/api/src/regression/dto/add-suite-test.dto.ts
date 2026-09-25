import { IsString } from 'class-validator';

export class AddSuiteTestDto {
  @IsString()
  regressionTestId!: string;
}
