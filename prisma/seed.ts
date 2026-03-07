import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const companies = [
    'bybid9',
    'ipay9',
    'bp77',
    'kingbet9',
    'me99',
    'rolex9',
    'gucci9',
    'pkm9',
    'winnie777',
    'micky9',
    'mrbean9',
    'ace96au',
  ]
  const names = ['SIM 1', 'SIM 2', 'SIM 3', 'SIM 4', 'SIM 5', 'SIM 6', 'SIM 7', 'SIM 8', 'SIM 9', 'SIM 10']

  await prisma.company.createMany({
    data: companies.map((code) => ({ id: code, code, name: code })),
    skipDuplicates: true,
  })

  const existingMachines = await prisma.senderMachine.findMany({
    select: { companyId: true, name: true },
  })
  const existingByCompany = new Set(existingMachines.map((m) => `${m.companyId}:${m.name}`))

  const toCreate: { id: string; name: string; apiToken: string; deviceIden: string; companyId: string }[] = []
  for (const companyCode of companies) {
    for (const name of names) {
      const key = `${companyCode}:${name}`
      if (!existingByCompany.has(key)) {
        toCreate.push({
          id: `sim-${companyCode}-${name.replace(' ', '-').toLowerCase()}`,
          name,
          apiToken: '',
          deviceIden: '',
          companyId: companyCode,
        })
      }
    }
  }

  if (toCreate.length === 0) {
    console.log('All companies already have SIM 1-SIM 10.')
    return
  }

  await prisma.senderMachine.createMany({
    data: toCreate,
    skipDuplicates: true,
  })
  console.log(`Created ${toCreate.length} sender machine(s) across ${companies.length} companies.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
