"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { canonicalWebSourceUrl } from "@/lib/webSourceProvenanceV2";

export function MarkdownMessage({
  children,
  className = "",
  allowedLinkUrls,
}: {
  children: string;
  className?: string;
  allowedLinkUrls?: readonly string[];
}) {
  const linkAllowed = (href: string | undefined): boolean => {
    if (allowedLinkUrls === undefined) return true;
    if (!href) return false;
    const target = canonicalWebSourceUrl(href);
    if (!target) return false;
    return allowedLinkUrls.some(
      (sourceUrl) => canonicalWebSourceUrl(sourceUrl) === target,
    );
  };

  return (
    <div className={cn("min-w-0 max-w-full overflow-hidden break-words [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ className, ...props }) => (
            <h1 className={cn("mb-3 text-xl font-semibold leading-tight", className)} {...props} />
          ),
          h2: ({ className, ...props }) => (
            <h2 className={cn("mb-2 mt-4 text-lg font-semibold leading-tight first:mt-0", className)} {...props} />
          ),
          h3: ({ className, ...props }) => (
            <h3 className={cn("mb-2 mt-3 text-base font-semibold leading-tight first:mt-0", className)} {...props} />
          ),
          p: ({ className, ...props }) => (
            <p className={cn("my-2 max-w-full break-words [overflow-wrap:anywhere] leading-7 first:mt-0 last:mb-0", className)} {...props} />
          ),
          ul: ({ className, ...props }) => (
            <ul className={cn("my-2 ml-5 list-disc space-y-1", className)} {...props} />
          ),
          ol: ({ className, ...props }) => (
            <ol className={cn("my-2 ml-5 list-decimal space-y-1", className)} {...props} />
          ),
          li: ({ className, ...props }) => (
            <li className={cn("leading-7", className)} {...props} />
          ),
          strong: ({ className, ...props }) => (
            <strong className={cn("font-semibold", className)} {...props} />
          ),
          em: ({ className, ...props }) => (
            <em className={cn("italic", className)} {...props} />
          ),
          code: ({ className, ...props }) => (
            <code
              className={cn(
                "max-w-full break-all rounded border bg-muted px-1 py-0.5 text-[0.9em] font-medium",
                className,
              )}
              {...props}
            />
          ),
          pre: ({ className, ...props }) => (
            <pre
              className={cn(
                "my-3 overflow-x-auto rounded-lg border bg-muted p-3 text-xs leading-6",
                className,
              )}
              {...props}
            />
          ),
          a: ({ className, href, children: linkChildren, ...props }) =>
            linkAllowed(href) ? (
              <a
                className={cn(
                  "break-all text-primary underline underline-offset-4",
                  className,
                )}
                target="_blank"
                rel="noreferrer"
                href={href}
                {...props}
              >
                {linkChildren}
              </a>
            ) : (
              <span className={cn("break-all", className)}>
                {linkChildren}
              </span>
            ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
