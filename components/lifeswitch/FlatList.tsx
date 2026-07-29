import * as React from "react";

import { cn } from "@/lib/utils";

export function FlatList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cn(
        "divide-y divide-border/50 border-y border-border/50",
        className,
      )}
      {...props}
    />
  );
}

type FlatListButtonProps = React.ComponentPropsWithoutRef<"button"> & {
  selected?: boolean;
};

export function FlatListButton({
  selected = false,
  className,
  type = "button",
  ...props
}: FlatListButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "min-h-12 w-full px-3 py-3 text-left transition-colors",
        selected ? "bg-muted/30" : "hover:bg-muted/20",
        className,
      )}
      {...props}
    />
  );
}

export function StatusText({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      className={cn(
        "shrink-0 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
