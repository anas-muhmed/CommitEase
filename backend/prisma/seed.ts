import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo data...');

  // ── Masjid ──────────────────────────────────────────────────────────────────
  const masjid = await prisma.masjid.upsert({
    where: { code: 'DEMO' },
    update: { status: 'ACTIVE' },
    create: {
      code: 'DEMO',
      name: 'Masjid Al-Noor (Demo)',
      address: '12 Demo Street, City',
      contactPhone: '9999999999',
      status: 'ACTIVE',
    },
  });
  console.log(`Masjid: ${masjid.name}  code=${masjid.code}`);

  // ── Committee admin user ────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.upsert({
    where: { masjidId_username: { masjidId: masjid.id, username: 'admin' } },
    update: {},
    create: {
      masjidId: masjid.id,
      name: 'Demo Admin',
      username: 'admin',
      passwordHash,
      role: 'COMMITTEE_ADMIN',
      mustChangePassword: false,
    },
  });
  console.log(`User: ${user.username}  password=demo1234`);

  // ── Contribution plans ──────────────────────────────────────────────────────
  const generalPlan = await prisma.contributionPlan.upsert({
    where: { masjidId_name: { masjidId: masjid.id, name: 'General Member' } },
    update: {},
    create: { masjidId: masjid.id, name: 'General Member', description: 'Standard monthly contribution' },
  });
  const patronPlan = await prisma.contributionPlan.upsert({
    where: { masjidId_name: { masjidId: masjid.id, name: 'Patron' } },
    update: {},
    create: { masjidId: masjid.id, name: 'Patron', description: 'Higher contribution tier' },
  });

  // Set fees (only if no fee history exists)
  const generalFeeCount = await prisma.contributionFeeHistory.count({ where: { contributionPlanId: generalPlan.id } });
  if (generalFeeCount === 0) {
    await prisma.contributionFeeHistory.create({
      data: { contributionPlanId: generalPlan.id, monthlyFee: 100, effectiveFrom: new Date('2025-01-01') },
    });
  }
  const patronFeeCount = await prisma.contributionFeeHistory.count({ where: { contributionPlanId: patronPlan.id } });
  if (patronFeeCount === 0) {
    await prisma.contributionFeeHistory.create({
      data: { contributionPlanId: patronPlan.id, monthlyFee: 250, effectiveFrom: new Date('2025-01-01') },
    });
  }
  console.log(`Plans: General Member (₹100/mo), Patron (₹250/mo)`);

  // ── Members ─────────────────────────────────────────────────────────────────
  const members = [
    { code: 'MBR-001', name: 'Ahmed Al-Rashid', phone: '9876543210', planId: generalPlan.id, startDate: new Date('2025-01-01'), openingDue: 0 },
    { code: 'MBR-002', name: 'Yusuf Ibrahim', phone: '9876543211', planId: generalPlan.id, startDate: new Date('2025-01-01'), openingDue: 200 },
    { code: 'MBR-003', name: 'Fatima Malik', phone: '9876543212', planId: patronPlan.id, startDate: new Date('2025-03-01'), openingDue: 0 },
    { code: 'MBR-004', name: 'Hassan Siddiqui', phone: '9876543213', planId: generalPlan.id, startDate: new Date('2024-07-01'), openingDue: 0 },
    { code: 'MBR-005', name: 'Zainab Qureshi', phone: '9876543214', planId: patronPlan.id, startDate: new Date('2025-06-01'), openingDue: 0 },
    { code: 'MBR-006', name: 'Omar Farooq', phone: '9876543215', planId: generalPlan.id, startDate: new Date('2024-10-01'), openingDue: 500 },
    { code: 'MBR-007', name: 'Aisha Rahman', phone: '9876543216', planId: generalPlan.id, startDate: new Date('2025-02-01'), openingDue: 0 },
    { code: 'MBR-008', name: 'Bilal Hussain', phone: '9876543217', planId: generalPlan.id, startDate: new Date('2025-04-01'), openingDue: 0 },
  ];

  for (const m of members) {
    await prisma.member.upsert({
      where: { masjidId_memberCode: { masjidId: masjid.id, memberCode: m.code } },
      update: {},
      create: {
        masjidId: masjid.id,
        memberCode: m.code,
        name: m.name,
        phone: m.phone,
        contributionPlanId: m.planId,
        contributionStartDate: m.startDate,
        openingDueBalance: m.openingDue,
      },
    });
  }
  console.log(`Members: ${members.length} created`);

  // ── Sample payments ──────────────────────────────────────────────────────────
  // Only seed payments if none exist for this masjid
  const existingPayments = await prisma.payment.count({ where: { masjidId: masjid.id } });
  if (existingPayments === 0) {
    const ahmed = await prisma.member.findUnique({ where: { masjidId_memberCode: { masjidId: masjid.id, memberCode: 'MBR-001' } } });
    const yusuf = await prisma.member.findUnique({ where: { masjidId_memberCode: { masjidId: masjid.id, memberCode: 'MBR-002' } } });

    if (ahmed) {
      const p = await prisma.payment.create({
        data: {
          masjidId: masjid.id,
          memberId: ahmed.id,
          recordedByUserId: user.id,
          amount: 300,
          paymentMode: 'CASH',
          paymentStatus: 'SUCCESS',
          paymentDate: new Date('2026-06-10'),
        },
      });
      await prisma.receipt.create({
        data: {
          masjidId: masjid.id,
          paymentId: p.id,
          receiptNumber: 'RCP-00001',
        },
      });
      // Allocate: Jan, Feb, Mar 2026 @ ₹100 each
      for (const [idx, month] of (['2026-01-01', '2026-02-01', '2026-03-01'] as const).entries()) {
        await prisma.paymentAllocation.create({
          data: { paymentId: p.id, contributionMonth: new Date(month), amountAllocated: 100, paymentStatus: 'SUCCESS' },
        });
      }
    }

    if (yusuf) {
      const p = await prisma.payment.create({
        data: {
          masjidId: masjid.id,
          memberId: yusuf.id,
          recordedByUserId: user.id,
          amount: 200,
          paymentMode: 'ONLINE',
          paymentStatus: 'SUCCESS',
          paymentDate: new Date('2026-06-15'),
        },
      });
      await prisma.receipt.create({
        data: {
          masjidId: masjid.id,
          paymentId: p.id,
          receiptNumber: 'RCP-00002',
        },
      });
    }

    console.log('Sample payments created');
  } else {
    console.log(`Skipped payments — ${existingPayments} already exist`);
  }

  console.log('\n✓ Seed complete');
  console.log('─────────────────────────────');
  console.log('Login credentials:');
  console.log('  Masjid Code : DEMO');
  console.log('  Username    : admin');
  console.log('  Password    : demo1234');
  console.log('─────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
