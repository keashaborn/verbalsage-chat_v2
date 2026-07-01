import * as React from "react";

export function selectNumberInputValue(
  e: React.FocusEvent<HTMLInputElement> | React.MouseEvent<HTMLInputElement>
) {
  const input = e.currentTarget;

  const selectAll = () => {
    try {
      input.focus();
      input.select();
      input.setSelectionRange(0, input.value.length);
    } catch {
      // Some mobile browsers reject setSelectionRange for certain input states.
    }
  };

  if (typeof window !== "undefined") {
    window.requestAnimationFrame(selectAll);
    window.setTimeout(selectAll, 0);
  } else {
    selectAll();
  }
}
