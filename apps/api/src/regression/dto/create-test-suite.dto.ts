import { IsString } from 'class-validator';

export class CreateTestSuiteDto {
  @IsString()
  name!: string;
}
