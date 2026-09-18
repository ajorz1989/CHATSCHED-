import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./UiIcons";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;
  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-20 sm:bottom-6 right-5 z-40 w-11 h-11 inline-flex items-center justify-center border-[3px] border-billboard-ink bg-billboard-yellow text-billboard-ink rounded shadow-blockSm hover:-translate-y-0.5 hover:shadow-block transition"
    >
      <ArrowUpIcon className="w-5 h-5" />
    </button>
  );
}
