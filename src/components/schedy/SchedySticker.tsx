import type { SchedyStickerName, SchedyClaimStickerName } from './schedyAssets';
import { SCHEDY_BASE } from './schedyAssets';

type Base = { size?: number; className?: string };

// "booked" and "paid" state a fact, so TypeScript forces you to confirm it is true for this user.
type Props =
  | (Base & { name: Exclude<SchedyStickerName, SchedyClaimStickerName> })
  | (Base & { name: SchedyClaimStickerName; confirmed: true });

/** Reaction sticker. Decorative: always pair with real text that carries the meaning. */
export function SchedySticker(props: Props) {
  const { name, size = 96, className = '' } = props;
  return (
    <img
      src={`${SCHEDY_BASE}/stickers/schedy-${name}.svg`}
      alt=""
      width={size}
      height={size}
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
}

export default SchedySticker;
