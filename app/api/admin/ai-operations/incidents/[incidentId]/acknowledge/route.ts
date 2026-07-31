import { mutateAiOperationsIncident } from "@/app/api/admin/ai-operations/_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  context: { params: Promise<{ incidentId: string }> },
) {
  const { incidentId } = await context.params;
  return mutateAiOperationsIncident(req, incidentId, "acknowledge");
}
