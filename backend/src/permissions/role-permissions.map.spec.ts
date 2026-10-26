import { Role } from '@prisma/client';
import { ROLE_PERMISSIONS_MAP } from './role-permissions.map';
import { Permission } from './permissions.enum';

describe('ROLE_PERMISSIONS_MAP', () => {
  it.each(Object.values(Role))('grants ACTIVITY_READ to %s', (role) => {
    expect(ROLE_PERMISSIONS_MAP[role]).toContain(Permission.ACTIVITY_READ);
  });

  it.each([Role.MANAGER, Role.MEMBER, Role.VIEWER])('keeps AUDIT_READ away from %s', (role) => {
    expect(ROLE_PERMISSIONS_MAP[role]).not.toContain(Permission.AUDIT_READ);
  });
});
