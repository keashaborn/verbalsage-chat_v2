export type ForegroundThreadSyncState = {
  loading: boolean;
  sending: boolean;
  hasDraft: boolean;
  editing: boolean;
  voiceBusy: boolean;
  playbackBusy: boolean;
  privacyDialogOpen: boolean;
};

export type ForegroundThreadSyncDecision =
  | "none"
  | "refresh_current"
  | "switch_now"
  | "defer";

export function canApplyForegroundThreadSync(
  state: ForegroundThreadSyncState,
): boolean {
  return (
    !state.loading &&
    !state.sending &&
    !state.hasDraft &&
    !state.editing &&
    !state.voiceBusy &&
    !state.playbackBusy &&
    !state.privacyDialogOpen
  );
}

export function decideForegroundThreadSync(
  localThreadId: string | null,
  serverThreadId: string | null,
  state: ForegroundThreadSyncState,
): ForegroundThreadSyncDecision {
  const safe = canApplyForegroundThreadSync(state);

  if (localThreadId === serverThreadId) {
    return safe && serverThreadId ? "refresh_current" : "none";
  }

  return safe ? "switch_now" : "defer";
}
