import { Assistant } from "./assistant";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProductAccessGate } from "@/components/auth/ProductAccessGate";
import { requestSiteId } from "@/lib/siteBrandServer";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function Home() {
  const siteId = await requestSiteId();
  return (
    <AuthGate>
      <ProductAccessGate
        product={siteId === "lifeswitch" ? "lifeswitch" : "verbal_sage"}
      >
        <Assistant />
      </ProductAccessGate>
    </AuthGate>
  );
}
