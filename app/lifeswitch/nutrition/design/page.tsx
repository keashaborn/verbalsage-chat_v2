import Link from "next/link";

export default function NutritionDesignHub() {
  return (
    <div className="grid gap-3">
      <div className="text-lg font-semibold">Nutrition · Design</div>
      <div className="text-sm text-muted-foreground">Build foods and meals used for logging and plans.</div>

      <Link href="/lifeswitch/nutrition/foods" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">My Foods</div>
        <div className="mt-1 text-xs text-muted-foreground">USDA import + serving presets.</div>
      </Link>

      <Link href="/lifeswitch/nutrition/meals" className="rounded-xl border p-4 hover:bg-muted/30">
        <div className="text-sm font-semibold">Meals</div>
        <div className="mt-1 text-xs text-muted-foreground">Meal templates composed of foods.</div>
      </Link>
    </div>
  );
}
