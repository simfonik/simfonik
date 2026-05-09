"use client";

import { useEffect, useRef } from "react";

interface OscilloscopeProps {
  className?: string;
}

// Soundcloud-style playback waveform: vertical hairlines across the width,
// each one's height modulated by a sum-of-sines so the whole thing reads
// as a track playing back. Non-blocky — each bar is a 1.5px stroke.
export function Oscilloscope({ className = "" }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let dpr = window.devicePixelRatio || 1;
    let w = 0;
    let h = 0;
    let visible = true;
    let strokeColor = getComputedStyle(canvas).color || "#000";

    const resize = () => {
      dpr = window.devicePixelRatio || 1;
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && !document.hidden;
      },
      { threshold: 0 },
    );
    io.observe(canvas);

    const updateStrokeColor = () => {
      strokeColor = getComputedStyle(canvas).color || strokeColor;
    };
    const mo = new MutationObserver(updateStrokeColor);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    const onVisibilityChange = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const start = performance.now();
    const BAR_SPACING = 4; // px between bars

    const drawFrame = () => {
      const t = (performance.now() - start) / 1000;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.5;
      ctx.lineCap = "round";

      const centerY = h / 2;
      const maxAmp = h * 0.4;

      ctx.beginPath();
      for (let x = BAR_SPACING / 2; x < w; x += BAR_SPACING) {
        const u = x / Math.max(w, 1);
        // Sum of sines → audio-waveform-like character
        const wave =
          Math.sin(u * Math.PI * 3 + t * 0.5) * 0.45 +
          Math.sin(u * Math.PI * 8 + t * 0.72) * 0.3 +
          Math.sin(u * Math.PI * 17 + t * 1.05) * 0.2;
        // Slow drifting envelope so the whole track "breathes"
        const envelope = 0.55 + 0.45 * Math.sin(t * 0.22 + u * Math.PI * 1.3);
        const heightNorm = Math.abs(wave) * envelope;
        const barHalf = maxAmp * heightNorm;
        // Minimum 1px height so even quiet sections show a tick
        const drawHalf = Math.max(barHalf, 0.5);
        ctx.moveTo(x, centerY - drawHalf);
        ctx.lineTo(x, centerY + drawHalf);
      }
      ctx.stroke();
    };

    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      if (!visible) return;
      drawFrame();
    };

    if (reduceMotion) {
      drawFrame();
    } else {
      tick();
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height: "100%" }}
      aria-hidden
    />
  );
}
