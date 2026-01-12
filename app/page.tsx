import { Assistant } from "./assistant";
import { AuthGate } from "@/components/auth/AuthGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function Home() {
  return (
    <AuthGate>
      <Assistant />
    </AuthGate>
  );
}
