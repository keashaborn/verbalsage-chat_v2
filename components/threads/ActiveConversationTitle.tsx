"use client";

import * as React from "react";

type ActiveThreadMetadata = {
  thread_id?: string | null;
  title?: string | null;
};

export function ActiveConversationTitle({
  className = "",
}: {
  className?: string;
}) {
  const [title, setTitle] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onMetadata = (event: Event) => {
      const detail = (event as CustomEvent<ActiveThreadMetadata>).detail;
      const nextTitle = String(detail?.title || "").trim();
      setTitle(nextTitle || "New chat");
    };

    window.addEventListener("vs_active_thread_metadata", onMetadata);
    return () =>
      window.removeEventListener("vs_active_thread_metadata", onMetadata);
  }, []);

  return (
    <div
      className={`min-w-0 truncate text-center text-sm font-medium ${className}`}
      title={title || undefined}
      aria-live="polite"
      aria-atomic="true"
    >
      {title || <span className="sr-only">Loading conversation title</span>}
    </div>
  );
}
