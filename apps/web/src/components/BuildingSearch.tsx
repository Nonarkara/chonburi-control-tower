import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { BuildingProperties } from "../map/layers";

interface Hit {
  feature: Feature<Polygon | MultiPolygon, BuildingProperties>;
  display: string;
  alt?: string;
  centroid: [number, number];
}

interface Props {
  buildings: FeatureCollection<Polygon | MultiPolygon, BuildingProperties> | null;
  onSelect: (centroid: [number, number], building: BuildingProperties) => void;
}

function centroid(geom: Polygon | MultiPolygon): [number, number] {
  const ring =
    geom.type === "Polygon"
      ? geom.coordinates[0]
      : geom.coordinates[0][0]; // first ring of first polygon for MultiPolygon
  let sx = 0;
  let sy = 0;
  for (const [x, y] of ring) {
    sx += x;
    sy += y;
  }
  return [sx / ring.length, sy / ring.length];
}

export function BuildingSearch({ buildings, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleBlur = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setOpen(false), 150);
  };

  const index: Hit[] = useMemo(() => {
    if (!buildings) return [];
    const out: Hit[] = [];
    for (const f of buildings.features) {
      const p = f.properties;
      const en = p.nameEn ?? null;
      const th = p.nameTh ?? null;
      const generic = p.name ?? null;
      const display = en ?? generic ?? th;
      if (!display) continue;
      const alt = display === th ? en ?? undefined : th ?? undefined;
      out.push({
        feature: f,
        display,
        alt,
        centroid: centroid(f.geometry),
      });
    }
    return out;
  }, [buildings]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [] as Hit[];
    return index
      .filter((h) => {
        return (
          h.display.toLowerCase().includes(needle) ||
          (h.alt && h.alt.toLowerCase().includes(needle))
        );
      })
      .slice(0, 8);
  }, [index, q]);

  const pick = (h: Hit) => {
    onSelect(h.centroid, h.feature.properties);
    setQ(h.display);
    setOpen(false);
  };

  return (
    <div className="building-search">
      <input
        className="building-search-input mono"
        type="search"
        placeholder={
          buildings
            ? `Search ${index.length} named landmarks among ${buildings.features.length.toLocaleString()} buildings in Chonburi Town — "city hall" / "วัด" / "ตลาด"`
            : "Loading Chonburi buildings…"
        }
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        spellCheck={false}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul className="building-search-results" role="listbox">
          {results.map((h) => (
            <li
              key={h.feature.properties.id}
              role="option"
              aria-selected={false}
              tabIndex={0}
              onClick={() => pick(h)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  pick(h);
                }
              }}
              className="building-search-row"
            >
              <span className="building-search-name">{h.display}</span>
              {h.alt && <span className="building-search-alt mono">{h.alt}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
