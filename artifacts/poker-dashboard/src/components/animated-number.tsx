import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion, tween } from "@/lib/motion";

type AnimatedNumberProps = {
  value: number;
  format: (value: number) => string;
  /** Milliseconds. */
  duration?: number;
};

/** Counts from the previous value (or zero on first show) to `value`. Static if motion is reduced. */
export function AnimatedNumber({ value, format, duration = 1100 }: AnimatedNumberProps) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const fromRef = useRef(shown);

  useEffect(() => {
    if (prefersReducedMotion()) {
      setShown(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const next = tween(from, value, now - start, duration);
      fromRef.current = next;
      setShown(next);
      if (now - start < duration) frame = requestAnimationFrame(step);
      else {
        fromRef.current = value;
        setShown(value);
      }
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <>{format(shown)}</>;
}
