// Wall behavior: a pan-and-zoom frame built from the UI SDK's viewport behavior.
import { createViewport, css, definePrimitive, live } from "@ui-sdk/core";

export const wall = definePrimitive({
  name: "wall",
  state: () => ({ viewport: { x: 0, y: 0, zoom: 1 } }),
  live: ["viewport"],
  api: (context) => {
    const viewport = createViewport(context, {
      key: "viewport",
      surface: () => context.element("root"),
      minZoom: () => 0.04,
      maxZoom: () => 2,
      message: (zoom) => `Wall at ${Math.round(zoom * 100)} percent`,
    });
    return { viewport };
  },
  slots: (slot) => ({
    root: slot({
      attrs: () => ({
        tabindex: "0",
        style: css({ position: "relative", overflow: "clip", "touch-action": "none" }),
      }),
      on: {
        wheel: (event, { api }) => api.viewport.wheel(event),
        pointerdown: (event, { api }) => {
          // Presses on the zoom controls are theirs, not the start of a pan.
          if (!(event.target as HTMLElement).closest?.("[data-wall-hud]")) api.viewport.pointerdown(event);
        },
        keydown: (event, { api }) => api.viewport.keydown(event),
      },
    }),
    world: slot({
      attrs: () => ({ style: css({ position: "absolute", left: "0", top: "0" }) }),
      live: live((state, { api }) => ({ style: api.viewport.style(state) })),
    }),
  }),
});
