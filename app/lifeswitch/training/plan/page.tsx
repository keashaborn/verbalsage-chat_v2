import { redirect } from "next/navigation";

export default function TrainingPlanRedirect() {
  redirect("/lifeswitch/plan?section=training#training-targets");
}
