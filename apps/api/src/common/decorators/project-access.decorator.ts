import { SetMetadata } from '@nestjs/common';

export const PROJECT_ACCESS_KEY = 'projectAccess';

export type OrgRoleName = 'admin' | 'developer' | 'reviewer';

export const ProjectAccess = (
  ...roles: OrgRoleName[]
): MethodDecorator & ClassDecorator =>
  SetMetadata(PROJECT_ACCESS_KEY, roles);
