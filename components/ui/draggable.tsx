"use client";

import { GripVertical } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Lets a floating panel be dragged by a grip. Pointer-capture based, clamped loosely to the
 * viewport so a panel can never be lost off-screen. Purely presentational — no store state.
 */
export function useDraggable() {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    start.current = { px: event.clientX, py: event.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent) => {
    if (!start.current) return;
    const nextX = start.current.ox + event.clientX - start.current.px;
    const nextY = start.current.oy + event.clientY - start.current.py;
    const limit = 0.42;
    setOffset({
      x: Math.max(-window.innerWidth * limit, Math.min(window.innerWidth * limit, nextX)),
      y: Math.max(-window.innerHeight * limit, Math.min(window.innerHeight * limit, nextY)),
    });
  };
  const onPointerUp = () => {
    start.current = null;
    setDragging(false);
  };

  return {
    style: offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined,
    dragging,
    reset: () => setOffset({ x: 0, y: 0 }),
    handle: { onPointerDown, onPointerMove, onPointerUp },
  };
}

export type DragHandleProps = ReturnType<typeof useDraggable>["handle"];

/** Grip bar that a draggable panel is moved by. */
export function DragHandle({
  handle,
  label,
  dragging,
}: {
  handle: DragHandleProps;
  label: string;
  dragging: boolean;
}) {
  return (
    <div
      className={`panel-grip${dragging ? " is-dragging" : ""}`}
      role="button"
      aria-label={`Mover ${label}`}
      tabIndex={0}
      {...handle}
    >
      <GripVertical size={13} />
      <span>{label}</span>
    </div>
  );
}
