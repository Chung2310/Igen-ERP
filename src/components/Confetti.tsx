import React from "react";

const pieces = Array.from({ length: 18 }, (_, idx) => idx + 1);

export default function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((index) => {
        const left = Math.round(Math.random() * 100);
        const delay = (Math.random() * 1.2).toFixed(2);
        const size = Math.round(6 + Math.random() * 10);
        const hue = 40 + Math.round(Math.random() * 220);
        return (
          <span
            key={index}
            className="confetti-piece absolute block rounded-full"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size}px`,
              backgroundColor: `hsl(${hue}, 85%, 60%)`,
              animationDelay: `${delay}s`,
            }}
          />
        );
      })}
    </div>
  );
}
