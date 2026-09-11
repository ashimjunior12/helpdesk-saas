import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { UserModel } from '../auth/user.model.js';
import { hashPassword } from '../auth/password.js';

// Ensures the configured account (SUPER_ADMIN_EMAIL) is a platform super admin.
// Runs at startup and is idempotent:
//  - if that email already exists, it is promoted to SUPER_ADMIN if needed
//    (its password is never changed);
//  - otherwise a new super admin is created from SUPER_ADMIN_EMAIL /
//    SUPER_ADMIN_PASSWORD.
// Any other pre-existing super admin is left untouched.
export async function ensureSuperAdmin(): Promise<void> {
  const email = env.SUPER_ADMIN_EMAIL;
  const existing = await UserModel.findOne({ email });

  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      existing.role = 'SUPER_ADMIN';
      existing.organizationId = null;
      existing.isActive = true;
      await existing.save();
      logger.info({ operation: 'seed.superAdmin', email }, 'Promoted existing user to super admin');
    }
    return;
  }

  await UserModel.create({
    email,
    name: 'Super Admin',
    passwordHash: await hashPassword(env.SUPER_ADMIN_PASSWORD),
    role: 'SUPER_ADMIN',
    organizationId: null,
    isActive: true,
  });

  logger.info(
    { operation: 'seed.superAdmin', email },
    'Seeded platform super admin (change the password after first login)',
  );
}
