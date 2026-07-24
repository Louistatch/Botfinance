import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint l'accès d'une route à un ou plusieurs rôles.
 * @example @Roles(Role.ADMIN, Role.CREDIT_ANALYST)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
