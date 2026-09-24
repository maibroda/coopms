"use server";
import { act } from "./_run";
import * as svc from "@/lib/services/schedule";
import { fromMonthInput } from "@/lib/dates";

export async function postScheduleAction(monthInput: string) {
  return act(
    "schedule.post",
    async (ctx) => {
      const result = await svc.postSchedule(ctx, fromMonthInput(monthInput));
      return { message: `${monthInput} posted to payroll for ${result.rows.length} members.` };
    },
    ["/schedule", "/members", "/loans"],
  );
}
