import { randomBytes } from 'crypto';
import type { PrismaClient } from '@prisma/client';

const SIM_NAMES = [
  'SIM 1', 'SIM 2', 'SIM 3', 'SIM 4', 'SIM 5',
  'SIM 6', 'SIM 7', 'SIM 8', 'SIM 9', 'SIM 10',
] as const;

export function normalizeCompanyName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (t.length < 2 || t.length > 120) return null;
  return t;
}

function slugify(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (s.length > 0) return s;
  return `co-${randomBytes(4).toString('hex')}`;
}

async function allocateUniqueCode(
  prisma: PrismaClient,
  base: string,
): Promise<string> {
  let code = base.slice(0, 60);
  for (let attempt = 0; attempt < 20; attempt++) {
    const taken = await prisma.company.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!taken) return code;
    code = `${base}-${randomBytes(3).toString('hex')}`.slice(0, 64);
  }
  throw new Error('Could not allocate unique company code');
}

/**
 * Creates a new Company row, 10 SenderMachines, and one Admin — all in a
 * single transaction so partial state is impossible.
 */
export async function createCompanyWithAdmin(
  prisma: PrismaClient,
  companyDisplayName: string,
  username: string,
  hashedPassword: string,
): Promise<void> {
  const baseCode = slugify(companyDisplayName);
  const code = await allocateUniqueCode(prisma, baseCode);

  await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { code, name: companyDisplayName },
    });

    await tx.senderMachine.createMany({
      data: SIM_NAMES.map((name) => ({
        name,
        apiToken: '',
        deviceIden: '',
        companyId: company.id,
      })),
    });

    await tx.admin.create({
      data: {
        username,
        password: hashedPassword,
        companyId: company.id,
      },
    });
  });
}
