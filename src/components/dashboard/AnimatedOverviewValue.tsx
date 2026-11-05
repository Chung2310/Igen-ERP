import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

export function AnimatedOverviewValue({ value, format }: { value: number | null | undefined; format: (value: number) => string }) {
  const reduceMotion = useReducedMotion();
  const validValue = value != null && Number.isFinite(value) ? value : null;
  const [animation, setAnimation] = useState<{ target: number | null; current: number | null }>(() => ({ target: validValue, current: validValue == null ? null : 0 }));
  const current = animation.target === validValue ? animation.current : validValue == null ? null : 0;

  useEffect(() => {
    if (validValue == null) {
      setAnimation({ target: null, current: null });
      return;
    }
    if (reduceMotion || validValue === 0) {
      setAnimation({ target: validValue, current: validValue });
      return;
    }
    setAnimation({ target: validValue, current: 0 });
    const controls = animate(0, validValue, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (next) => setAnimation({ target: validValue, current: Math.min(Math.max(next, Math.min(0, validValue)), Math.max(0, validValue)) }),
      onComplete: () => setAnimation({ target: validValue, current: validValue }),
    });
    return () => controls.stop();
  }, [validValue, reduceMotion]);

  const finalText = validValue == null ? "—" : format(validValue);
  return <><span aria-hidden="true">{current == null ? "—" : format(Math.round(current))}</span><span className="sr-only">{finalText}</span></>;
}
