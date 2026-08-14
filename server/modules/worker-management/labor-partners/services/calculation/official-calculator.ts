import type { OfficialMilestone } from "../../interfaces/commission-policy.interface";

export function addCalendarMonths(date: string, months: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonthIndex = month - 1 + months;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = (targetMonthIndex % 12 + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

export function calculateOfficialMilestones(input: { employmentStartDate: string; periodStart: string; periodEnd: string; milestones: OfficialMilestone[]; alreadyApprovedMonths: number[]; isEligible: (milestone: OfficialMilestone, dueDate: string) => boolean }) {
  return input.milestones
    .filter((milestone) => !input.alreadyApprovedMonths.includes(milestone.month))
    .map((milestone) => ({ milestone, dueDate: addCalendarMonths(input.employmentStartDate, milestone.month) }))
    .filter(({ dueDate }) => dueDate >= input.periodStart && dueDate < input.periodEnd)
    .filter(({ milestone, dueDate }) => input.isEligible(milestone, dueDate))
    .map(({ milestone, dueDate }) => ({ month: milestone.month, dueDate, amount: milestone.amount }));
}
