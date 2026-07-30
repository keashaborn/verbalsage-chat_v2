import { assertValidSagePageContract } from "./pageContract";
import type { SagePageContract } from "./pageContract";
import { nutritionLogContract } from "./pageContracts/nutritionLog";
import { trainingCalendarContract } from "./pageContracts/trainingCalendar";

const contracts = [nutritionLogContract, trainingCalendarContract] as const;

for (const contract of contracts) {
  assertValidSagePageContract(contract);
}

export const sagePageContracts: readonly SagePageContract[] = contracts;

export type SagePageContractMatch = Readonly<{
  contract: SagePageContract;
  routeMatch: "canonical" | "alias";
}>;

function normalizePathname(raw: string): string {
  const pathname = String(raw || "").split(/[?#]/, 1)[0] || "";
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function resolveSagePageContract(
  rawPathname: string,
): SagePageContractMatch | null {
  const pathname = normalizePathname(rawPathname);

  for (const contract of sagePageContracts) {
    if (contract.route.canonicalPath === pathname) {
      return { contract, routeMatch: "canonical" };
    }
    if (contract.route.aliases.includes(pathname)) {
      return { contract, routeMatch: "alias" };
    }
  }

  return null;
}
