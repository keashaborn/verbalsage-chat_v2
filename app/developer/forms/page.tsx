"use client";

import FormsBuilderPage from "@/components/forms/FormsBuilderPage";
import { AuthGate } from "@/components/auth/AuthGate";
import { ProductAccessGate } from "@/components/auth/ProductAccessGate";

export default function DeveloperFormsPage() {
  return (
    <AuthGate>
      <ProductAccessGate product="lifeswitch">
        <FormsBuilderPage />
      </ProductAccessGate>
    </AuthGate>
  );
}
