"use client";

// Chibi incense stick that burns down until the deadline (docs/ui-design.md §4.5).
// The last 3 seconds turn the ember red and shake the stick.

import { useEffect, useRef, useState } from "react";

const TOP = 14;
const BOTTOM = 80;

export function Incense({
  deadline,
  phaseId,
  label,
  className = "",
}: {
  deadline: number;
  /** Restarts the burn when a new window opens. */
  phaseId: number;
  label: string;
  className?: string;
}) {
  const start = useRef({ phaseId, at: Date.now() });
  if (start.current.phaseId !== phaseId) start.current = { phaseId, at: Date.now() };
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      setNow(Date.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const total = Math.max(1, deadline - start.current.at);
  const left = Math.max(0, deadline - now);
  const fraction = left / total;
  const urgent = left <= 3_000;
  const top = BOTTOM - (BOTTOM - TOP) * fraction;

  return (
    <svg
      viewBox="0 0 40 110"
      role="timer"
      aria-label={label}
      className={`${urgent ? "animate-[wiggle_0.25s_ease-in-out_infinite]" : ""} ${className}`}
    >
      <path
        d={`M20 ${top - 4} C14 ${top - 14} 26 ${top - 22} 20 ${top - 32}`}
        stroke="#e6dccb"
        strokeWidth="2.5"
        fill="none"
        opacity={0.5}
        strokeLinecap="round"
      />
      <rect x="18" y={top} width="4" height={Math.max(0, BOTTOM - top)} fill="#9b3b22" />
      <rect x="18.5" y={BOTTOM} width="3" height="10" fill="#c9a24a" />
      <circle
        cx="20"
        cy={top}
        r="4"
        fill={urgent ? "#ff3b2f" : "#ffb347"}
        stroke="#1d1230"
        strokeWidth="1.5"
      />
      <path
        d="M4 90 H36 Q34 106 20 108 Q6 106 4 90 Z"
        fill="#ffd23f"
        stroke="#1d1230"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="20" cy="90" rx="16" ry="4" fill="#3a1a0c" stroke="#1d1230" strokeWidth="2" />
    </svg>
  );
}
