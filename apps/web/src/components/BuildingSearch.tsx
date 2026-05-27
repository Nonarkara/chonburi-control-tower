import { useEffect, useMemo, useRef, useState } from "react";
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from "geojson";
import type { BuildingProperties } from "../map/layers";
import { centroid } from "../lib/geo";

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

// centroid() imported from ../lib/geo (pure, unit-tested).

const LISTBOX_ID = "building-search-results";

export function BuildingSearch({ buildings, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
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
    setFocusedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0) {
      e.preventDefault();
      pick(results[focusedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setFocusedIndex(-1);
    }
  };

  return (
    <div className="building-search">
      <input
        className="building-search-input mono"
        type="search"
        role="combobox"
        aria-label="Search buildings by name"
        aria-controls={open && results.length > 0 ? LISTBOX_ID : undefined}
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
        aria-activedescendant={
          focusedIndex >= 0
            ? `bsr-${results[focusedIndex]?.feature.properties.id}`
            : undefined
        }
        placeholder={
          buildings
            ? `Search ${index.length} landmarks · "city hall" / "วัด" / "ตลาด"`
            : "Loading Chonburi buildings…"
        }
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setFocusedIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
      />
      {open && results.length > 0 && (
        <ul
          id={LISTBOX_ID}
          className="building-search-results"
          role="listbox"
          aria-label="Building search results"
        >
          {results.map((h, i) => (
            <li
              id={`bsr-${h.feature.properties.id}`}
              key={h.feature.properties.id}
              role="option"
              aria-selected={i === focusedIndex}
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
