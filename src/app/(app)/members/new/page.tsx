import { requirePage } from "@/lib/auth/session";
import { MemberForm } from "@/components/forms/member-form";

export default async function NewMemberPage() {
  await requirePage("member.manage");
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-xl font-semibold">Add member</h1>
      <MemberForm />
    </div>
  );
}
