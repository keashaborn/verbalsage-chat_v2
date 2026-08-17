import { Assistant } from "./assistant";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProductAccessGate } from "@/components/auth/ProductAccessGate";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Home() {
  return (
    <AuthGate>
      <ProductAccessGate product="verbal_sage">
        <Assistant />
      </ProductAccessGate>
    </AuthGate>
  );
}
