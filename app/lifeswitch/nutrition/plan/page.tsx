import { redirect } from "next/navigation";

export default function NutritionPlanRedirect() {
  redirect("/lifeswitch/plan?section=nutrition#nutrition-targets");
}
