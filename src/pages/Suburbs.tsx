import { useState } from "react";
import { Link } from "react-router-dom";
import { SA_CITIES_SUBURBS } from "../lib/constants";
import { usePublishers } from "../hooks/usePublishers";
import Seo from "../components/Seo";

export default function Suburbs() {
  const { publishers } = usePublishers();
  const [activeCity, setActiveCity] = useState(SA_CITIES_SUBURBS[0].city);

  const active = SA_CITIES_SUBURBS.find((c) => c.city === activeCity) ?? SA_CITIES_SUBURBS[0];

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo title="Suburbs · ChatSched" description="Browse South African publishers and creators by suburb, across every major city in the country." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Suburbs</span>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <h1 className="text-3xl md:text-4xl max-w-xl">Right down to your neighbourhood.</h1>
        <Link to="/map" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:bg-billboard-paperDim transition shrink-0">
          Map view →
        </Link>
      </div>
      <p className="text-billboard-inkSoft max-w-xl mb-8">
        Live nationwide — pick a city, then a suburb, to see the pages and creators already reaching that neighbourhood.
      </p>

      <div className="flex flex-wrap gap-2 mb-8">
        {SA_CITIES_SUBURBS.map((c) => (
          <button
            key={c.city}
            onClick={() => setActiveCity(c.city)}
            className={`font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded-full px-3.5 py-2 transition ${
              activeCity === c.city ? "bg-billboard-ink text-billboard-paper" : "bg-white hover:bg-billboard-paperDim"
            }`}
          >
            {c.city} <span className="opacity-60 normal-case">· {c.province}</span>
          </button>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {active.suburbs.map((suburb) => {
          const count = publishers.filter((p) => p.suburb === suburb).length;
          return (
            <Link
              key={suburb}
              to={`/browse?suburb=${encodeURIComponent(suburb)}`}
              className="border-[3px] border-billboard-ink rounded p-5 bg-white transition hover:-translate-y-1 hover:shadow-block"
            >
              <h3 className="font-bold mb-1">{suburb}</h3>
              <span className="font-mono text-xs text-billboard-greenDeep font-semibold">
                {count} {count === 1 ? "publisher" : "publishers"} →
              </span>
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-billboard-inkSoft mt-8">
        Not seeing your suburb or city? <Link to="/browse" className="underline font-semibold">Browse everyone</Link> and filter by province and city instead.
      </p>
    </div>
  );
}
