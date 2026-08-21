import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const base = {
  width: 18,
  height: 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const PauseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M9 6v12M15 6v12" />
  </svg>
);
export const PlayIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m9 7 8 5-8 5V7Z" />
  </svg>
);
export const SlidersIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M10 14v6" />
  </svg>
);
export const SparkIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3Z" />
    <path d="m18 15 .7 2.3L21 18l-2.3.7L18 21l-.7-2.3L15 18l2.3-.7L18 15Z" />
  </svg>
);
export const RecordIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
  </svg>
);
export const ExpandIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
  </svg>
);
export const CloseIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
export const ShieldIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
export const ChevronIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="m8 10 4 4 4-4" />
  </svg>
);
export const ShuffleIcon = (props: IconProps) => (
  <svg {...base} {...props}>
    <path d="M4 7h3c4 0 5 10 10 10h3M18 15l2 2-2 2M4 17h3c1.4 0 2.4-1.2 3.3-2.8M14 8.9c.8-1.1 1.8-1.9 3.7-1.9H20M18 5l2 2-2 2" />
  </svg>
);
