"use client";

import * as Dialog from "@radix-ui/react-dialog";
import * as React from "react";

type ConfirmActionOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "destructive" | "primary";
};

type PendingConfirmation = ConfirmActionOptions & {
  resolve: (confirmed: boolean) => void;
};

type ConfirmAction = (options: ConfirmActionOptions) => Promise<boolean>;

const ConfirmActionContext = React.createContext<ConfirmAction | null>(null);

export function useConfirmAction(): ConfirmAction {
  const confirmAction = React.useContext(ConfirmActionContext);
  if (!confirmAction) {
    throw new Error("useConfirmAction must be used within ConfirmActionProvider");
  }
  return confirmAction;
}

export function ConfirmActionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pendingRef = React.useRef<PendingConfirmation | null>(null);
  const [pending, setPending] = React.useState<PendingConfirmation | null>(null);

  const settle = React.useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    pendingRef.current = null;
    setPending(null);
    current?.resolve(confirmed);
  }, []);

  const confirmAction = React.useCallback<ConfirmAction>((options) => {
    pendingRef.current?.resolve(false);

    return new Promise<boolean>((resolve) => {
      const request = { ...options, resolve };
      pendingRef.current = request;
      setPending(request);
    });
  }, []);

  React.useEffect(
    () => () => {
      pendingRef.current?.resolve(false);
      pendingRef.current = null;
    },
    [],
  );

  const destructive = pending?.tone !== "primary";

  return (
    <ConfirmActionContext.Provider value={confirmAction}>
      {children}

      <Dialog.Root
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed top-1/2 left-1/2 z-[120] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl outline-none">
            <Dialog.Title className="text-base font-semibold">
              {pending?.title}
            </Dialog.Title>
            {pending?.description ? (
              <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                {pending.description}
              </Dialog.Description>
            ) : null}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                onClick={() => settle(false)}
                autoFocus
              >
                Cancel
              </button>
              <button
                type="button"
                className={
                  destructive
                    ? "rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
                    : "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
                }
                onClick={() => settle(true)}
              >
                {pending?.confirmLabel || "Confirm"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmActionContext.Provider>
  );
}
