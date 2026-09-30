import { useEffect, useRef, useState } from "react";

type Props = {
  /** 1080p WebM, tried first on desktop. */
  webm: string;
  /** 1080p MP4 fallback for desktop. */
  mp4: string;
  /** Smaller MP4 served to phones (viewport under 768px). */
  mp4Small: string;
  poster: string;
  width?: number;
  height?: number;
};

/**
 * Silent, decorative looping video (all meaning lives in on-screen text or in
 * live text beside it, so it is aria-hidden).
 *
 * Loading: nothing heavy downloads with the page. The poster is fetched once
 * the video is within ~300px of the viewport, and playback starts then and
 * pauses when it scrolls away. Visitors who prefer reduced motion get the
 * poster only. Phones get the smaller MP4.
 */
export default function LazyLoopVideo({ webm, mp4, mp4Small, poster, width = 1920, height = 1080 }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [near, setNear] = useState(false);
  const [small] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNear(true);
          if (!reduceMotion) video.play().catch(() => undefined);
        } else {
          video.pause();
        }
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(video);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 block w-full h-full object-cover pointer-events-none"
      width={width}
      height={height}
      poster={near ? poster : undefined}
      muted
      loop
      playsInline
      preload="none"
      aria-hidden="true"
    >
      {small ? (
        <source src={mp4Small} type="video/mp4" />
      ) : (
        <>
          <source src={webm} type="video/webm" />
          <source src={mp4} type="video/mp4" />
        </>
      )}
    </video>
  );
}
