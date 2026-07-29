"use client";

import Script from "next/script";
import * as React from "react";

const TURNSTILE_SCRIPT =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const TURNSTILE_SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || "";

export type TurnstileAction =
  | "auth_login"
  | "password_reset"
  | "request_access";

type TurnstileApi = {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "timeout-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  remove(widgetId: string): void;
  reset(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export type TurnstileWidgetHandle = {
  reset(): void;
};

export const TurnstileWidget = React.forwardRef<
  TurnstileWidgetHandle,
  {
    action: TurnstileAction;
    onToken: (token: string) => void;
  }
>(function TurnstileWidget({ action, onToken }, forwardedRef) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenRef = React.useRef(onToken);

  React.useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  const renderWidget = React.useCallback(() => {
    if (
      !TURNSTILE_SITE_KEY ||
      !containerRef.current ||
      widgetIdRef.current ||
      !window.turnstile
    ) {
      return;
    }

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      action,
      theme: "auto",
      callback: (token) => onTokenRef.current(token),
      "expired-callback": () => onTokenRef.current(""),
      "timeout-callback": () => onTokenRef.current(""),
      "error-callback": () => onTokenRef.current(""),
    });
  }, [action]);

  React.useEffect(() => {
    renderWidget();
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
    };
  }, [renderWidget]);

  React.useImperativeHandle(
    forwardedRef,
    () => ({
      reset() {
        onTokenRef.current("");
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
        }
      },
    }),
    [],
  );

  if (!TURNSTILE_SITE_KEY) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        Security verification is temporarily unavailable.
      </p>
    );
  }

  return (
    <div className="min-h-[70px]" aria-label="Security verification">
      <Script
        id="cloudflare-turnstile"
        src={TURNSTILE_SCRIPT}
        strategy="afterInteractive"
        onReady={renderWidget}
      />
      <div ref={containerRef} />
    </div>
  );
});
