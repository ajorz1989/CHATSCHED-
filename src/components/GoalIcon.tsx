import MarketingIcon, { type MarketingIconName } from "./MarketingIcon";

/**
 * Illustrated icons for the four Build My Campaign goals. Drawn in the
 * billboard system rather than generic line icons: bold ink outlines
 * (currentColor, so they follow the card's text colour), flat brand fills,
 * and the same hard offset shadow used by shadow-blockSm. Fills stay inside
 * the palette (paper #FAF9F5, yellow #F5B700, green #1C6B45, red #D4451F)
 * and every shape has an ink outline, so they read on both the paper card
 * and the selected yellow card.
 */

const PAPER = "#FAF9F5";
const YELLOW = "#F5B700";
const GREEN = "#1C6B45";
const RED = "#D4451F";
const SW = 2.4;

const stroke = { stroke: "currentColor", strokeWidth: SW, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Spark({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z"
      fill={YELLOW}
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinejoin="round"
    />
  );
}

/** Awareness: a billboard broadcasting to both sides, with reach bars on the board. */
function Awareness() {
  return (
    <>
      {/* signal arcs */}
      <path d="M42 15a7 7 0 0 1 0 10M45 12a11 11 0 0 1 0 16M6 15a7 7 0 0 0 0 10M3 12a11 11 0 0 0 0 16" fill="none" {...stroke} />
      {/* posts + ground */}
      <path d="M17 30v14M31 30v14M12 44h24" fill="none" {...stroke} />
      {/* lamps */}
      <path d="M17 12V8.5M31 12V8.5" fill="none" {...stroke} />
      <circle cx="17" cy="7" r="2" fill={YELLOW} {...stroke} strokeWidth={1.8} />
      <circle cx="31" cy="7" r="2" fill={YELLOW} {...stroke} strokeWidth={1.8} />
      {/* board, hard shadow first */}
      <rect x="12" y="14" width="28" height="18" rx="2" fill="currentColor" />
      <rect x="10" y="12" width="28" height="18" rx="2" fill={PAPER} {...stroke} />
      {/* reach bars */}
      <rect x="15" y="22" width="4" height="5" fill={GREEN} />
      <rect x="22" y="19" width="4" height="8" fill={GREEN} />
      <rect x="29" y="16" width="4" height="11" fill={GREEN} />
    </>
  );
}

/** Lead generation: an enquiry bubble answered by a confirmed (green, ticked) bubble. */
function Leads() {
  return (
    <>
      <path
        d="M8 7H28A3 3 0 0 1 31 10V21A3 3 0 0 1 28 24H17L10 30V24H8A3 3 0 0 1 5 21V10A3 3 0 0 1 8 7Z"
        fill={PAPER}
        {...stroke}
      />
      <path d="M10 13.5h16M10 18.5h9" fill="none" {...stroke} strokeWidth={2} />
      {/* front bubble: hard shadow, then fill */}
      <path
        transform="translate(2 2)"
        d="M23 24H40A3 3 0 0 1 43 27V37A3 3 0 0 1 40 40H38V46L31 40H23A3 3 0 0 1 20 37V27A3 3 0 0 1 23 24Z"
        fill="currentColor"
      />
      <path
        d="M23 24H40A3 3 0 0 1 43 27V37A3 3 0 0 1 40 40H38V46L31 40H23A3 3 0 0 1 20 37V27A3 3 0 0 1 23 24Z"
        fill={GREEN}
        {...stroke}
      />
      <path d="M26 32.5l3.5 3.5L37 28.5" fill="none" stroke={PAPER} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** Traffic & conversion: a striped-awning shop with a cursor landing on its door. */
function Traffic() {
  return (
    <>
      {/* shop body: hard shadow, then fill */}
      <rect x="10" y="24" width="30" height="20" fill="currentColor" />
      <rect x="8" y="22" width="30" height="20" fill={PAPER} {...stroke} />
      {/* door */}
      <rect x="18" y="30" width="11" height="12" fill={YELLOW} {...stroke} />
      {/* awning */}
      <path d="M6 22L9 11H37L40 22Z" fill={PAPER} />
      <path d="M9 11H13.7L11.7 22H6Z M18.3 11H23V22H17.3Z M27.7 11H32.3L34.3 22H28.7Z" fill={RED} />
      <path d="M6 22L9 11H37L40 22Z" fill="none" {...stroke} />
      {/* cursor landing on the door */}
      <path
        d="M27 31V43L30 40.2L32.3 45L34.7 43.9L32.4 39.2H36.4Z"
        fill="currentColor"
        stroke={PAPER}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </>
  );
}

/** Launch, promotion & demand: a rocket with a red/paper livery, flame and sparks. */
function Launch() {
  return (
    <>
      <g transform="translate(24 24) rotate(45) scale(1.12) translate(-24 -24)">
        {/* fins */}
        <path d="M18 24L11 32V37L18 32Z" fill={RED} {...stroke} />
        <path d="M30 24L37 32V37L30 32Z" fill={RED} {...stroke} />
        {/* flame */}
        <path d="M21 35Q24 47 27 35Z" fill={YELLOW} {...stroke} />
        {/* body */}
        <path d="M24 4C31 9 32 20 30 30H18C16 20 17 9 24 4Z" fill={PAPER} {...stroke} />
        <path d="M19 30H29L27 34H21Z" fill="currentColor" {...stroke} strokeWidth={1.4} />
        <circle cx="24" cy="16.5" r="3.4" fill={GREEN} {...stroke} strokeWidth={2} />
      </g>
      <Spark x={9} y={11} s={1.15} />
      <Spark x={41} y={39} s={0.95} />
      <circle cx="42" cy="22" r="1.6" fill={RED} stroke="currentColor" strokeWidth={1.2} />
      <circle cx="6" cy="30" r="1.4" fill={GREEN} stroke="currentColor" strokeWidth={1.2} />
    </>
  );
}

const ILLUSTRATIONS: Record<string, () => React.JSX.Element> = {
  cross_platform_awareness: Awareness,
  multi_channel_leads: Leads,
  omnichannel_traffic: Traffic,
  launch_demand: Launch,
};

export default function GoalIcon({
  id,
  fallback,
  className = "w-14 h-14",
}: {
  id: string;
  fallback: MarketingIconName;
  className?: string;
}) {
  const Illustration = ILLUSTRATIONS[id];
  if (!Illustration) return <MarketingIcon name={fallback} className={className} />;
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      <Illustration />
    </svg>
  );
}
