import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const names = ['SIM 1', 'SIM 2', 'SIM 3', 'SIM 4', 'SIM 5', 'SIM 6', 'SIM 7', 'SIM 8', 'SIM 9', 'SIM 10']
  const existing = await prisma.senderMachine.findMany({
    select: { name: true },
  })
  const existingNames = new Set(existing.map((m) => m.name))
  const toCreate = names.filter((name) => !existingNames.has(name))
  if (toCreate.length === 0) {
    console.log('Already have all 10 sender machines (SIM 1–SIM 10).')
    return
  }
  await prisma.senderMachine.createMany({
    data: toCreate.map((name) => ({ name, apiToken: '', deviceIden: '' })),
  })
  console.log(`Created ${toCreate.length} sender machine(s): ${toCreate.join(', ')}. Fill apiToken and deviceIden in Prisma Studio for the new ones.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
