/**
 * Cooperative Management System demo seed.
 * Creates an Admin, a Treasurer and a pre-activated Member login, 35 demo members (a mix of
 * long-tenured members carrying opening balances migrated from manual records, and newer
 * joiners), a spread of loans (flat + reducing, multiple concurrent loans on some members,
 * one suspended, one defaulted, one completed within the window) and product sales on
 * installment. Then posts the payroll deduction schedule for every month from January through
 * September 2026 so there is nine months of real ledger history.
 *
 * WARNING: this TRUNCATES every table before seeding.
 */
import "dotenv/config";
import { db } from "../src/lib/db";
import { createUser } from "../src/lib/services/auth";
import { createMember } from "../src/lib/services/members";
import { createLoan, suspendLoan, markLoanStatus, requestLoan, recordManualLoanRepayment } from "../src/lib/services/loans";
import { createSale, requestSale, recordSaleRepayment } from "../src/lib/services/sales";
import { submitPaymentClaim, confirmPaymentClaim } from "../src/lib/services/paymentClaims";
import { postSchedule } from "../src/lib/services/schedule";
import { createLoanProduct } from "../src/lib/services/settings";
import type { Ctx } from "../src/lib/auth/context";
import type { RepaymentType } from "../src/lib/calc";

const PASSWORD = "Password123!";

async function truncateAll() {
  await db.$transaction([
    db.auditLog.deleteMany(),
    db.paymentClaim.deleteMany(),
    db.loanProduct.deleteMany(),
    db.cooperativeSettings.deleteMany(),
    db.balanceImportRow.deleteMany(),
    db.balanceImport.deleteMany(),
    db.apiKey.deleteMany(),
    db.deductionScheduleRun.deleteMany(),
    db.loanRepayment.deleteMany(),
    db.productRepayment.deleteMany(),
    db.loan.deleteMany(),
    db.productSale.deleteMany(),
    db.contribution.deleteMany(),
    db.user.deleteMany(),
    db.member.deleteMany(),
  ]);
}

const FIRST_NAMES = [
  "Adaeze", "Chinedu", "Ngozi", "Emeka", "Fatima", "Ibrahim", "Blessing", "Tunde", "Amaka", "Yusuf",
  "Chioma", "Segun", "Grace", "Musa", "Funmi", "Kelechi", "Aisha", "Obinna", "Temitope", "Hauwa",
  "Uche", "Bola", "Ifeoma", "Sani", "Rita", "Chukwuemeka", "Zainab", "Damilola", "Patience", "Abubakar",
];
const LAST_NAMES = [
  "Okafor", "Balogun", "Eze", "Mohammed", "Nwosu", "Okoro", "Abdullahi", "Adeyemi", "Uzoma", "Bello",
  "Chukwu", "Okon", "Adebayo", "Nnamdi", "Yakubu", "Igwe", "Suleiman", "Okonkwo", "Danjuma", "Obi",
  "Ogunleye", "Nwachukwu", "Aliyu", "Ojo", "Chibueze", "Garba", "Onyekachi", "Lawal", "Nnaji", "Sadiq",
];
const DEPARTMENTS = [
  "Operations", "Finance", "Human Resources", "Logistics", "Information Technology",
  "Legal", "Procurement", "Customer Service", "Engineering", "Marketing",
];
const BANKS = ["GTBank", "Access Bank", "Zenith Bank", "First Bank", "UBA", "Fidelity Bank", "Sterling Bank", "Union Bank", "Wema Bank", "Stanbic IBTC"];

function fakeAccountNumber(seed: number): string {
  return String(1000000000 + ((seed * 7919) % 900000000)).padStart(10, "0");
}

interface GeneratedMember {
  fullName: string;
  department: string;
  employeeNumber: string;
  dateJoined: string;
  monthlyContribution: number;
  phone: string;
  email: string;
  openingSavingsBalance: number;
  bankName: string;
  bankAccountNumber: string;
  bankAccountName: string;
}

function generateMembers(count: number): GeneratedMember[] {
  const out: GeneratedMember[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[i % LAST_NAMES.length];
    const fullName = `${first} ${last}`;
    const department = DEPARTMENTS[i % DEPARTMENTS.length];
    // Spread joining dates from 2020 through mid-2026; earlier joiners carry an opening balance
    // migrated from the cooperative's manual records, newer joiners started fresh in the system.
    const joinYear = Math.min(2020 + Math.floor(i / 6), 2026);
    const joinMonth = Math.min(1 + (i % 12), joinYear >= 2026 ? 6 : 12);
    const dateJoined = `${joinYear}-${String(joinMonth).padStart(2, "0")}-01`;
    const monthlyContribution = 5000 + (i % 9) * 2500;
    // Approximate savings accumulated before the system went live (Jan 2026) from tenure ×
    // contribution — long-tenured members end up with realistic multi-hundred-thousand balances.
    const tenureMonths = Math.max(0, (2026 - joinYear) * 12 - (joinMonth - 1));
    const openingSavingsBalance = joinYear < 2026 ? tenureMonths * monthlyContribution : 0;
    const bank = BANKS[i % BANKS.length];
    out.push({
      fullName,
      department,
      employeeNumber: `EMP-${String(1001 + i).padStart(4, "0")}`,
      dateJoined,
      monthlyContribution,
      phone: `080${String(30000000 + i).padStart(8, "0")}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@coop.test`,
      openingSavingsBalance,
      bankName: bank,
      bankAccountNumber: fakeAccountNumber(i + 1),
      bankAccountName: fullName.toUpperCase(),
    });
  }
  return out;
}

async function main() {
  console.log("Truncating…");
  await truncateAll();

  console.log("Creating users…");
  const admin = await createUser({ email: "admin@coop.test", password: PASSWORD, name: "Admin User", role: "ADMIN" });
  const treasurer = await createUser({ email: "treasurer@coop.test", password: PASSWORD, name: "Bisi Treasurer", role: "TREASURER" });
  const ctx: Ctx = { userId: admin.id, role: "ADMIN", name: admin.name, email: admin.email };
  const treasurerCtx: Ctx = { userId: treasurer.id, role: "TREASURER", name: treasurer.name, email: treasurer.email };

  console.log("Creating loan products…");
  await createLoanProduct(ctx, { name: "Emergency Loan", interestRate: 12, durationMonths: 6, repaymentType: "FLAT" });
  await createLoanProduct(ctx, { name: "Standard Loan", interestRate: 10, durationMonths: 12, repaymentType: "FLAT" });
  await createLoanProduct(ctx, { name: "Long-Term Reducing Loan", interestRate: 8, durationMonths: 24, repaymentType: "REDUCING" });

  console.log("Creating 35 members…");
  const specs = generateMembers(35);
  const members = [];
  for (const spec of specs) {
    members.push(await createMember(ctx, spec));
  }
  const [m0, m1, m2, m3, m4, m5, m6, m7, m8, m9] = members;

  await createUser({ email: "member1@coop.test", password: PASSWORD, name: m0.fullName, role: "MEMBER", memberId: m0.id });

  console.log("Creating loans…");
  const loanSpecs: {
    memberId: string;
    loanAmount: number;
    interestRate: number;
    durationMonths: number;
    repaymentType: RepaymentType;
    startMonth: string;
    note?: string;
  }[] = [
    { memberId: m0.id, loanAmount: 200000, interestRate: 10, durationMonths: 12, repaymentType: "FLAT", startMonth: "2026-06-01", note: "Standard flat-rate loan" },
    { memberId: m1.id, loanAmount: 150000, interestRate: 8, durationMonths: 10, repaymentType: "REDUCING", startMonth: "2026-07-01" },
    { memberId: m1.id, loanAmount: 80000, interestRate: 6, durationMonths: 6, repaymentType: "FLAT", startMonth: "2026-08-01", note: "Second concurrent loan — aggregated with the first on the payroll schedule." },
    { memberId: m2.id, loanAmount: 60000, interestRate: 10, durationMonths: 3, repaymentType: "FLAT", startMonth: "2026-01-01", note: "Short loan — fully repaid within the demo window." },
    { memberId: m3.id, loanAmount: 100000, interestRate: 9, durationMonths: 8, repaymentType: "REDUCING", startMonth: "2026-02-01" },
    { memberId: m4.id, loanAmount: 250000, interestRate: 12, durationMonths: 12, repaymentType: "FLAT", startMonth: "2026-03-01" },
    { memberId: m5.id, loanAmount: 90000, interestRate: 8, durationMonths: 6, repaymentType: "REDUCING", startMonth: "2026-04-01", note: "Suspended for a stretch of months — see below." },
    { memberId: m6.id, loanAmount: 130000, interestRate: 10, durationMonths: 9, repaymentType: "FLAT", startMonth: "2026-01-01", note: "Marked defaulted for demo purposes." },
    { memberId: m7.id, loanAmount: 175000, interestRate: 11, durationMonths: 10, repaymentType: "REDUCING", startMonth: "2026-05-01" },
    { memberId: m8.id, loanAmount: 50000, interestRate: 7, durationMonths: 4, repaymentType: "FLAT", startMonth: "2026-06-01" },
    { memberId: m9.id, loanAmount: 220000, interestRate: 10, durationMonths: 11, repaymentType: "FLAT", startMonth: "2026-02-01" },
    { memberId: members[10].id, loanAmount: 70000, interestRate: 9, durationMonths: 5, repaymentType: "REDUCING", startMonth: "2026-07-01" },
    { memberId: members[11].id, loanAmount: 140000, interestRate: 10, durationMonths: 8, repaymentType: "FLAT", startMonth: "2026-01-01" },
  ];
  const loans = [];
  for (const spec of loanSpecs) loans.push(await createLoan(ctx, spec));

  // Suspend member m5's loan for a couple of months, then let it auto-resume.
  await suspendLoan(ctx, loans[6].id, "2026-06-01", "2026-08-01");
  // Mark member m6's loan defaulted.
  await markLoanStatus(ctx, loans[7].id, "DEFAULTED");

  console.log("Creating product sales…");
  const saleSpecs = [
    { memberId: m3.id, itemName: "Samsung Galaxy A55 (Phone)", category: "PHONE" as const, cost: 120000, interestRate: 5, durationMonths: 6, startMonth: "2026-05-01" },
    { memberId: m2.id, itemName: "HP Pavilion Laptop", category: "LAPTOP" as const, cost: 280000, interestRate: 6, durationMonths: 8, startMonth: "2026-02-01" },
    { memberId: members[12].id, itemName: "Bag of Rice & Foodstuff", category: "FOOD" as const, cost: 45000, interestRate: 3, durationMonths: 3, startMonth: "2026-03-01" },
    { memberId: members[13].id, itemName: "LG Refrigerator", category: "APPLIANCE" as const, cost: 210000, interestRate: 6, durationMonths: 9, startMonth: "2026-04-01" },
    { memberId: members[14].id, itemName: "iPhone 13", category: "PHONE" as const, cost: 350000, interestRate: 5, durationMonths: 10, startMonth: "2026-06-01" },
    { memberId: members[15].id, itemName: "Dell Inspiron Laptop", category: "LAPTOP" as const, cost: 260000, interestRate: 6, durationMonths: 8, startMonth: "2026-01-01" },
    { memberId: members[16].id, itemName: "Generator Set", category: "APPLIANCE" as const, cost: 180000, interestRate: 6, durationMonths: 6, startMonth: "2026-05-01" },
    { memberId: members[17].id, itemName: "Foodstuff Bundle", category: "FOOD" as const, cost: 35000, interestRate: 3, durationMonths: 2, startMonth: "2026-07-01" },
  ];
  for (const spec of saleSpecs) await createSale(ctx, spec);

  console.log("Posting payroll deduction schedules Jan–Sep 2026…");
  for (const month of ["01", "02", "03", "04", "05", "06", "07", "08", "09"]) {
    await postSchedule(ctx, new Date(`2026-${month}-01`));
  }

  console.log("Activating two more member logins for the self-service demo…");
  const m1User = await createUser({ email: specs[1].email, password: PASSWORD, name: m1.fullName, role: "MEMBER", memberId: m1.id });
  const m9User = await createUser({ email: specs[9].email, password: PASSWORD, name: m9.fullName, role: "MEMBER", memberId: m9.id });
  const m1Ctx: Ctx = { userId: m1User.id, role: "MEMBER", name: m1User.name, email: m1User.email, memberId: m1.id };
  const m9Ctx: Ctx = { userId: m9User.id, role: "MEMBER", name: m9User.name, email: m9User.email, memberId: m9.id };

  console.log("Demonstrating the approval workflow (pending requests)…");
  // A Treasurer-created loan needs Admin sign-off — real maker-checker, left pending for the demo.
  await createLoan(treasurerCtx, {
    memberId: members[18].id,
    loanAmount: 45000,
    interestRate: 8,
    durationMonths: 4,
    repaymentType: "FLAT",
    startMonth: "2026-10-01",
    note: "Treasurer-created — awaiting Admin approval.",
  });
  // A member's own loan/purchase request — also lands pending for staff review.
  await requestLoan(m9Ctx, { loanAmount: 60000, interestRate: 9, durationMonths: 6, repaymentType: "REDUCING", startMonth: "2026-10-01" });
  await requestSale(m1Ctx, { itemName: "Air Fryer", category: "APPLIANCE", cost: 55000, interestRate: 5, durationMonths: 4, startMonth: "2026-10-01" });
  // A loan well beyond the standard 150%-of-savings cap, let through as a flagged exception —
  // always PENDING and Admin-only to approve, regardless of who created it.
  await createLoan(treasurerCtx, {
    memberId: m0.id,
    loanAmount: 500000,
    interestRate: 10,
    durationMonths: 12,
    repaymentType: "FLAT",
    startMonth: "2026-10-01",
    exceptionReason: "Medical emergency — Board pre-approved an exception above the standard 150% cap.",
  });

  console.log("Demonstrating direct/manual repayments…");
  // A lump-sum extra payment straight onto an active loan (Treasurer recording cash/bank transfer).
  await recordManualLoanRepayment(treasurerCtx, loans[10].id, { amount: 15000, paidOn: "2026-09-20", reference: "BANK-TRF-88213" });
  // A product-sale repayment — previously impossible in this app; outstandingBalance now actually moves.
  await recordSaleRepayment(treasurerCtx, (await db.productSale.findFirstOrThrow({ where: { memberId: members[13].id } })).id, {
    amount: 50000,
    paidOn: "2026-09-18",
    reference: "CASH-RECEIPT-4471",
  });

  console.log("Demonstrating member-reported direct payments (PaymentClaim)…");
  // One confirmed (Treasurer already verified it against the bank statement)…
  const confirmedClaim = await submitPaymentClaim(m1Ctx, {
    target: "LOAN",
    loanId: loans[1].id,
    amount: 20000,
    paidOn: "2026-09-15",
    reference: "USSD-REF-00219",
    note: "Paying down my loan faster.",
  });
  await confirmPaymentClaim(treasurerCtx, confirmedClaim.id);
  // …and one left pending, ready to be confirmed live in the Approvals queue.
  await submitPaymentClaim(m9Ctx, { target: "SAVINGS", amount: 10000, paidOn: "2026-09-22", reference: "BANK-TRF-90142", note: "Extra savings top-up." });

  console.log("Seed complete — 35 members, nine months of posted history (Jan–Sep 2026).");
  console.log("Login: admin@coop.test / treasurer@coop.test / member1@coop.test — password: Password123!");
  console.log(`Member self-service demo logins: ${specs[1].email} and ${specs[9].email} (both Password123!).`);
  console.log("Check /approvals for pending loans/purchases, a payment claim, and an Admin-only eligibility exception.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => db.$disconnect());
