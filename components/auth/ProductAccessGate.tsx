"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { authFetch } from "@/lib/authFetch";
import {
  productTierLabel,
  type ProductId,
  type ProductTier,
} from "@/lib/productEntitlements";

type GateState =
  | { status: "loading" }
  | { status: "allowed"; tier: ProductTier }
  | { status: "denied"; tier: ProductTier | null }
  | { status: "unavailable" };

export function ProductAccessGate({
  product,
  children,
}: {
  product: ProductId;
  children: ReactNode;
}) {
  const [state, setState] = useState<GateState>({ status: "loading" });

  const checkAccess = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await authFetch("/api/auth/capabilities", {
        method: "GET",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null);
      const tier =
        payload?.product_tier === "verbal_sage" ||
        payload?.product_tier === "lifeswitch"
          ? payload.product_tier
          : null;
      const products = Array.isArray(payload?.products) ? payload.products : [];
      if (response.ok && payload?.ok && products.includes(product) && tier) {
        setState({ status: "allowed", tier });
        return;
      }
      if (response.status === 401 || response.status === 403) {
        setState({ status: "denied", tier });
        return;
      }
      setState({ status: "unavailable" });
    } catch {
      setState({ status: "unavailable" });
    }
  }, [product]);

  useEffect(() => {
    void checkAccess();
  }, [checkAccess]);

  if (state.status === "allowed") return children;

  if (state.status === "loading") {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background text-foreground">
        <div className="text-sm text-muted-foreground">Checking access…</div>
      </div>
    );
  }

  const denied = state.status === "denied";
  const verbalSageOnly = denied && state.tier === "verbal_sage";

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-background/95 p-4 text-foreground supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-xl">
      <div className="w-full max-w-md rounded-xl border bg-card/95 p-6 shadow-lg">
        <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Product access
        </div>
        <h1 className="mt-2 text-xl font-semibold">
          {denied ? "This product is not included" : "Access check unavailable"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {verbalSageOnly && product === "lifeswitch"
            ? "This account includes Verbal Sage chat. LifeSwitch planning, nutrition, training, measurements, and People require LifeSwitch access."
            : denied
              ? `This account is currently assigned to ${productTierLabel(state.tier)}. Ask the Owner to change its product access.`
              : "The current product access could not be verified. The application remains locked."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {verbalSageOnly && product === "lifeswitch" ? (
            <a
              href="https://verbalsage.com/"
              className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background"
            >
              Open Verbal Sage
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => void checkAccess()}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            Retry access check
          </button>
          <Link href="/settings/account" className="px-2 py-2 text-sm underline">
            Account settings
          </Link>
        </div>
      </div>
    </div>
  );
}
