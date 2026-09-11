import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { UserModel } from '../auth/user.model.js';
import { hashPassword } from '../auth/password.js';

// Ensures a platform SUPER_ADMIN exists. Runs at startup: if no super admin is
// present, one is created from SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD. It never
// overwrites an existing account, so changing the password later is safe.
export async function ensureSuperAdmin(): Promise<void> {
  const existing = await UserModel.findOne({ role: 'SUPER_ADMIN' });
  if (existing) {
    return;
  }

  // Guard against an email already used by a normal account.
  if (await UserModel.exists({ email: env.SUPER_ADMIN_EMAIL })) {
    logger.warn(
      { operation: 'seed.superAdmin', email: env.SUPER_ADMIN_EMAIL },
      'SUPER_ADMIN_EMAIL already belongs to a non-super-admin user; skipping seed',
    );
    return;
  }

  await UserModel.create({
    email: env.SUPER_ADMIN_EMAIL,
    name: 'Super Admin',
    passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
    role: 'SUPER_ADMIN',
    organizationId: null,
    isActive: true,
  });

  logger.info(
    { operation: 'seed.superAdmin', email: env.SUPER_ADMIN_EMAIL },
    'Seeded platform super admin (change the password after first login)',
  );
}
