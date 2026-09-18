import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { usePublishers } from "../hooks/usePublishers";
import { SA_CITIES_SUBURBS, SA_CITY_COORDS } from "../lib/constants";
import Seo from "../components/Seo";
import { SkeletonBlock } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

const SA_CENTER: [number, number] = [-29, 24.5];

function radiusForCount(count: number): number {
  if (count === 0) return 0;
  return Math.min(11, 6 + Math.sqrt(count) * 2);
}

export default function MapView() {
  const { publishers, loading } = usePublishers();
  const [activeCity, setActiveCity] = useState<string | null>(null);

  const cityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const city of SA_CITIES_SUBURBS) counts.set(city.city, 0);
    let unmatched = 0;
    for (const p of publishers) {
      const match = SA_CITIES_SUBURBS.find((c) => c.city.toLowerCase() === (p.city ?? "").trim().toLowerCase());
      if (match) counts.set(match.city, (counts.get(match.city) ?? 0) + 1);
      else unmatched++;
    }
    return { counts, unmatched };
  }, [publishers]);

  const cities = SA_CITIES_SUBURBS
    .map((c) => ({ ...c, count: cityCounts.counts.get(c.city) ?? 0 }))
    .sort((a, b) => b.count - a.count);

  const activePublishers = activeCity ? publishers.filter((p) => (p.city ?? "").trim().toLowerCase() === activeCity.toLowerCase()) : [];

  return (
    <div className="max-w-6xl mx-auto px-5 py-16">
      <Seo title="Publisher Map · ChatSched" description="See where ChatSched publishers and creators are based, across every major South African city." />
      <span className="inline-block font-mono text-xs font-semibold tracking-wider uppercase border-2 border-billboard-red text-billboard-red px-3 py-1.5 rounded mb-3">Map</span>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-2">
        <h1 className="text-3xl md:text-4xl max-w-xl">Where our publishers are.</h1>
        <Link to="/browse" className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-2 hover:bg-billboard-paperDim transition shrink-0">
          List view →
        </Link>
      </div>
      <p className="text-billboard-inkSoft max-w-xl mb-8">
        Pinned by city — tap a marker to see who's there, then jump into the full list to filter by suburb, category or platform.
      </p>

      {loading ? (
        <div className="h-[480px] border-[3px] border-billboard-ink/15 rounded overflow-hidden relative bg-billboard-paperDim">
          <SkeletonBlock className="absolute inset-0 border-0 rounded-none" />
          <div className="absolute inset-0 flex items-center justify-center">
            <EmptyState kind="map" title="Loading the map" compact />
          </div>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[1fr_280px] gap-5">
          <div className="border-[3px] border-billboard-ink rounded overflow-hidden h-[420px] sm:h-[520px]">
            <MapContainer center={SA_CENTER} zoom={5.2} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {cities.filter((c) => c.count > 0).map((c) => {
                const coords = SA_CITY_COORDS[c.city];
                if (!coords) return null;
                return (
                  <CircleMarker
                    key={c.city}
                    center={coords}
                    radius={radiusForCount(c.count)}
                    pathOptions={{ color: "#1A1712", weight: 2, fillColor: "#F5B700", fillOpacity: 0.9 }}
                    eventHandlers={{ click: () => setActiveCity(c.city) }}
                  >
                    <Popup>
                      <div className="font-sans">
                        <p className="font-bold mb-1">{c.city}, {c.province}</p>
                        <p className="text-sm mb-2">{c.count} {c.count === 1 ? "publisher" : "publishers"}</p>
                        <Link to={`/browse?city=${encodeURIComponent(c.city)}`} className="text-sm font-semibold underline">
                          Browse {c.city} →
                        </Link>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>

          {/* City list — doubles as an accessible fallback to the map itself */}
          <div className="border-[3px] border-billboard-ink rounded overflow-hidden max-h-[420px] sm:max-h-[520px] overflow-y-auto">
            {cities.map((c) => (
              <button
                key={c.city}
                onClick={() => setActiveCity(c.city)}
                className={`w-full text-left px-4 py-3 border-b border-billboard-ink/10 last:border-b-0 transition ${
                  activeCity === c.city ? "bg-billboard-yellow" : "hover:bg-billboard-paperDim"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm">{c.city}</span>
                  <span className="font-mono text-xs text-billboard-inkSoft">{c.count}</span>
                </div>
                <span className="font-mono text-[10px] uppercase text-billboard-inkSoft">{c.province}</span>
              </button>
            ))}
            {cityCounts.unmatched > 0 && (
              <div className="px-4 py-3 text-xs text-billboard-inkSoft">
                +{cityCounts.unmatched} more outside these 12 cities — <Link to="/browse" className="underline font-semibold">browse everyone</Link>.
              </div>
            )}
          </div>
        </div>
      )}

      {activeCity && (
        <div className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl">{activeCity} <span className="text-billboard-inkSoft font-sans text-base font-normal">· {activePublishers.length} {activePublishers.length === 1 ? "publisher" : "publishers"}</span></h2>
            <Link to={`/browse?city=${encodeURIComponent(activeCity)}`} className="font-mono text-xs font-semibold uppercase border-2 border-billboard-ink rounded px-3 py-1.5 hover:bg-billboard-paperDim transition">
              Browse all in {activeCity} →
            </Link>
          </div>
          {activePublishers.length === 0 ? (
            <p className="text-billboard-inkSoft text-sm">No approved publishers in {activeCity} yet.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activePublishers.slice(0, 9).map((p) => (
                <Link key={p.id} to={`/browse/${p.id}`} className="border-[3px] border-billboard-ink rounded p-4 bg-white transition hover:-translate-y-1 hover:shadow-blockSm">
                  <h3 className="font-bold mb-1">{p.name}</h3>
                  <p className="text-xs text-billboard-inkSoft">{p.category}{p.suburb ? ` · ${p.suburb}` : ""}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
