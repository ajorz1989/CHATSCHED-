import type { ReactNode } from 'react';
import { SCHEDY_SCENES, type SchedySceneKey } from './schedyAssets';

type Props = {
  scene: SchedySceneKey;
  title: string;
  message: string;
  /** Buttons/links. Pass your own <Button> or router <Link>, so this stays router-agnostic. */
  children?: ReactNode;
  /** 'h1' for full pages (404), 'h2' for empty states inside a page. */
  headingLevel?: 'h1' | 'h2';
  className?: string;
};

/**
 * Schedy illustration + headline + message + actions.
 * The illustration is decorative (alt=""). The title and message are live text.
 */
export function SchedyScene({ scene, title, message, children, headingLevel = 'h2', className = '' }: Props) {
  const s = SCHEDY_SCENES[scene];
  const Heading = headingLevel;
  return (
    <section className={`mx-auto flex max-w-xl flex-col items-center px-4 py-10 text-center ${className}`}>
      <img src={s.svg} alt="" width={s.w} height={s.h} className="h-auto w-full max-w-md" decoding="async" />
      <Heading
        className="mt-6 font-display text-2xl leading-tight text-billboard-ink sm:text-3xl"
      >
        {title}
      </Heading>
      <p className="mt-2 max-w-md text-base text-billboard-inkSoft">{message}</p>
      {children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}
    </section>
  );
}

export default SchedyScene;
