'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);
  const mousePos = useRef({ x: -100, y: -100 });
  const ringPos = useRef({ x: -100, y: -100 });
  const rafRef = useRef<number>(0);

  // Check if device has a fine pointer (mouse, not touch)
  const [hasMouse, setHasMouse] = useState(false);

  useEffect(() => {
    setHasMouse(window.matchMedia('(pointer: fine)').matches);
  }, []);

  const animate = useCallback(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    // Dot follows instantly
    dot.style.transform = `translate(${mousePos.current.x - 4}px, ${mousePos.current.y - 4}px)`;

    // Ring follows with smooth delay
    ringPos.current.x += (mousePos.current.x - ringPos.current.x) * 0.08;
    ringPos.current.y += (mousePos.current.y - ringPos.current.y) * 0.08;
    ring.style.transform = `translate(${ringPos.current.x - 20}px, ${ringPos.current.y - 20}px)`;

    rafRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    if (!hasMouse) return;

    const onMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);

      // Check if hovering over interactive element
      const target = e.target as HTMLElement;
      const isClickable = !!target.closest('a, button, input, select, textarea, [role="button"], label');
      setHovering(isClickable);
    };

    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);
    const onLeave = () => setVisible(false);
    const onEnter = () => setVisible(true);

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup', onUp);
    document.documentElement.addEventListener('mouseleave', onLeave);
    document.documentElement.addEventListener('mouseenter', onEnter);

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      document.documentElement.removeEventListener('mouseenter', onEnter);
      cancelAnimationFrame(rafRef.current);
    };
  }, [hasMouse, visible, animate]);

  if (!hasMouse) return null;

  return (
    <>
      {/* Hide default cursor globally via style tag */}
      <style>{`
        @media (pointer: fine) {
          *, *::before, *::after { cursor: none !important; }
        }
      `}</style>

      {/* Dot */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: clicking ? 6 : 8,
          height: clicking ? 6 : 8,
          borderRadius: '50%',
          background: 'var(--accent-primary)',
          pointerEvents: 'none',
          zIndex: 2147483647,
          opacity: visible ? 1 : 0,
          transition: 'width 0.15s, height 0.15s, opacity 0.2s',
          willChange: 'transform',
        }}
      />

      {/* Ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: hovering ? 50 : 40,
          height: hovering ? 50 : 40,
          borderRadius: '50%',
          border: `${hovering ? 2 : 1.5}px solid ${hovering ? 'var(--accent-primary)' : 'var(--accent-light, var(--accent-primary))'}`,
          background: hovering ? 'color-mix(in srgb, var(--accent-primary) 8%, transparent)' : 'transparent',
          pointerEvents: 'none',
          zIndex: 2147483646,
          opacity: visible ? (clicking ? 0.5 : 0.8) : 0,
          transition: 'width 0.3s cubic-bezier(0.16,1,0.3,1), height 0.3s cubic-bezier(0.16,1,0.3,1), border-color 0.2s, background 0.2s, opacity 0.2s',
          willChange: 'transform',
          transform: clicking ? 'scale(0.85)' : undefined,
        }}
      />
    </>
  );
}
