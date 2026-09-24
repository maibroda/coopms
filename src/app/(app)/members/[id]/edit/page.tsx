import { requirePage } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { num } from "@/lib/money";
import { iso } from "@/lib/dates";
import { MemberForm } from "@/components/forms/member-form";

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePage("member.manage");
  const { id } = await params;
  const member = await db.member.findUniqueOrThrow({ where: { id } });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Edit member</h1>
      <MemberForm
        initial={{
          id: member.id,
          membershipNumber: member.membershipNumber,
          fullName: member.fullName,
          department: member.department ?? undefined,
          employeeNumber: member.employeeNumber ?? undefined,
          dateJoined: iso(member.dateJoined),
          monthlyContribution: num(member.monthlyContribution),
          phone: member.phone ?? undefined,
          email: member.email ?? undefined,
          openingSavingsBalance: num(member.openingSavingsBalance),
          openingLoanBalance: num(member.openingLoanBalance),
          bankName: member.bankName ?? undefined,
          bankAccountNumber: member.bankAccountNumber ?? undefined,
          bankAccountName: member.bankAccountName ?? undefined,
        }}
      />
    </div>
  );
}
