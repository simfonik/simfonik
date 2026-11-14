// Lineup behavior: a list you reorder by dragging or with the keyboard, built from the UI SDK's
// reorder and roving-focus behaviors. Space or Enter picks a name up, arrows move it, Space drops it.
import { createChange, createReorder, createRovingFocus, definePrimitive, type ReorderDraft } from "@ui-sdk/core";

type LineupOptions = {
  value?: string[];
  onValueChange?: (value: string[]) => void;
};

export const lineup = definePrimitive({
  name: "lineup",
  options: { value: "list", onValueChange: "callback" },
  controlled: ["value"],
  state: (options: LineupOptions) => ({
    value: options.value ?? [],
    moving: null as ReorderDraft | null,
    focused: null as string | null,
  }),
  sync: (options) => (options.value === undefined ? {} : { value: options.value }),
  api: (context) => {
    const change = createChange(context);
    const roving = createRovingFocus(context, {
      slot: "item",
      key: "focused",
      orientation: () => "vertical",
      loop: () => false,
    });
    const reorder = createReorder(context, {
      slot: "item",
      key: "value",
      draft: "moving",
      set: (value, details) => change("value", value, details),
    });
    return { roving, reorder };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({ role: "listbox", "aria-roledescription": "sortable lineup", "aria-orientation": "vertical" }),
    }),
    item: slot<{ value: string }>({
      props: { value: "string" },
      attrs: (state, part) => ({
        role: "option",
        "aria-roledescription": "sortable set",
        "aria-selected": String(state.moving?.key === part.key),
        tabindex: part.api.roving.tabIndex(state, part),
        "data-grabbed": state.moving?.key === part.key ? "" : undefined,
      }),
      on: {
        keydown: (event, { el, api, key }) => api.reorder.keydown(event, key) || api.roving.keydown(event, el!),
        pointerdown: (event, { api, key }) => api.reorder.pointerdown(event, key),
      },
      bind: (el, part) => {
        const cleanups = [part.api.roving.bind(el, part), part.api.reorder.bind(el, part)];
        return () => cleanups.forEach((cleanup) => cleanup());
      },
    }),
  }),
});
