-- Add role column to Admin (default 'admin' for all existing users)
ALTER TABLE "Admin" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'admin';

-- Create system company for superadmin
INSERT INTO "Company" ("id", "code", "name", "createdAt", "updatedAt")
VALUES ('_system', '_system', '_system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

-- Create superadmin account
INSERT INTO "Admin" ("id", "username", "password", "role", "companyId", "createdAt", "updatedAt")
VALUES (
  'superadmin-001',
  'ether313',
  '$2b$10$nFbolvMN4P6qTLpIqI0uXOT6GK7G5IGKTXG4yRt/rdn9OclXLDi1.',
  'superadmin',
  '_system',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("username") DO NOTHING;
