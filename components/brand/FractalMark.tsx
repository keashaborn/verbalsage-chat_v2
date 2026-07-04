import * as React from "react";

type FractalMarkProps = React.SVGProps<SVGSVGElement> & {
  title?: string;
};

/**
 * Monochrome dotted vortex mark.
 * Uses currentColor so it works on dark/light backgrounds.
 */
export function FractalMark({ title, className, ...props }: FractalMarkProps) {
  const dots = React.useMemo(() => {
    const items: Array<{ x: number; y: number; r: number; opacity: number }> = [];

    const cx = 50;
    const cy = 50;

    // More like the uploaded mark: many curved radial rows orbiting a central void.
    const arms = 44;
    const perArm = 12;

    for (let arm = 0; arm < arms; arm++) {
      const base = (arm / arms) * Math.PI * 2;

      for (let j = 0; j < perArm; j++) {
        const u = j / (perArm - 1);

        // Center void starts around radius 14; outer radius reaches near edge.
        const radius = 14 + u * 32;

        // Twist each row so it forms a vortex, not a sunburst.
        const twist = 1.62 * (1 - u) + 0.34 * Math.sin(arm * 0.55);
        const theta = base + twist;

        const x = cx + Math.cos(theta) * radius;
        const y = cy + Math.sin(theta) * radius;

        // Outer dots are larger; inner dots are finer.
        const sizeWave = 0.72 + 0.32 * Math.sin(arm * 0.72 + j * 0.35);
        const r = (0.55 + u * 1.35) * sizeWave;

        // Slight fade variation gives the original dotted-depth feel.
        const opacity = Math.max(0.55, 0.92 - Math.abs(u - 0.78) * 0.22);

        items.push({ x, y, r, opacity });
      }
    }

    return items;
  }, []);

  return (
    <svg
      viewBox="4 4 92 92"
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      className={className}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <g fill="currentColor">
        {dots.map((d, i) => (
          <circle
            key={i}
            cx={d.x.toFixed(2)}
            cy={d.y.toFixed(2)}
            r={d.r.toFixed(2)}
            opacity={d.opacity.toFixed(2)}
          />
        ))}
      </g>
    </svg>
  );
}
