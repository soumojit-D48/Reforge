import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsIn } from 'class-validator';
import type { OrgRoleName } from '../../common/decorators/project-access.decorator.js';

export class AddMemberDto {
  @ApiProperty({ example: 'teammate@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: ['admin', 'developer', 'reviewer'] })
  @IsIn(['admin', 'developer', 'reviewer'])
  role!: OrgRoleName;
}
