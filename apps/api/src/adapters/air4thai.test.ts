import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchAir4Thai } from "./air4thai";

/**
 * Air4Thai (Thai PCD) adapter contract tests.
 *
 * The cache is module-level, so the FIRST test performs the network fetch and
 * the rest assert on the cached result. The mock payload mixes a Chonburi
 * station (kept), a Bangkok station (dropped — wrong province + out of bbox),
 * and a station with missing readings (kept, null-coerced).
 */

function makeStation(overrides: Record<string, unknown> = {}) {
  return {
    stationID: "34t",
    nameEN: "Environment Agency Section 13, Chonburi",
    nameTH: "สำนักงานสิ่งแวดล้อมภาคที่ 13",
    areaEN: "Ban Suan, Mueang, Chon Buri",
    areaTH: "ต.บ้านสวน อ.เมือง, ชลบุรี",
    lat: "13.35461667",
    long: "100.9792167",
    AQILast: {
      date: "2026-05-30",
      time: "14:00",
      PM25: { color_id: "2", aqi: "51", value: "25.1" },
      AQI: { color_id: "2", aqi: "51", param: "PM25" },
    },
    ...overrides,
  };
}

const BANGKOK_STATION = {
  stationID: "02t",
  nameEN: "Bansomdejchaopraya Rajabhat University",
  areaEN: "Hiran Ruchi, Khet Thon Buri, Bangkok",
  areaTH: "แขวงหิรัญรูจี เขตธนบุรี, กรุงเทพฯ",
  lat: "13.732846",
  long: "100.487662",
  AQILast: { date: "2026-05-30", time: "14:00", PM25: { value: "13.2" }, AQI: { aqi: "22" } },
};

describe("air4thai adapter (Thai PCD)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("requests the public Air4Thai endpoint and keeps only Chonburi stations", async () => {
    // FIRST test — cache miss, captures URL and exercises the filter.
    let capturedUrl = "";
    vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
      capturedUrl = String(url);
      const payload = {
        stations: [
          makeStation(),
          BANGKOK_STATION,
          makeStation({
            stationID: "32t",
            nameEN: "Laem Chabang Municipal Stadium",
            areaEN: "Thung Sukhla, Si Racha, Chon buri",
            lat: "13.11923333",
            long: "100.91855",
            AQILast: { date: "2026-05-30", time: "14:00", PM25: { value: "-1" }, AQI: { aqi: "-1" } },
          }),
        ],
      };
      return Promise.resolve(new Response(JSON.stringify(payload), { status: 200 }));
    });

    const feed = await fetchAir4Thai();

    expect(capturedUrl).toContain("air4thai.pcd.go.th");
    // Bangkok station dropped; two Chonburi stations kept.
    expect(feed.features).toHaveLength(2);
    expect(feed.features.every((f) => f.station.length > 0)).toBe(true);
  });

  it("returns a live NormalizedFeed with EPA-banded categories", async () => {
    const feed = await fetchAir4Thai(); // cached

    expect(feed.meta.source).toBe("air4thai-pcd");
    expect(feed.meta.fallbackTier).toBe("live");

    const banSuan = feed.features.find((f) => f.source === "air4thai:34t");
    expect(banSuan).toBeDefined();
    expect(banSuan?.pm25).toBe(25.1);
    expect(banSuan?.aqi).toBe(51);
    expect(banSuan?.category).toBe("moderate"); // 25.1 µg/m³ → moderate
    expect(banSuan?.observedAt).toBe("2026-05-30T14:00:00+07:00");
  });

  it("coerces Air4Thai's -1 sentinel readings to null", async () => {
    const feed = await fetchAir4Thai(); // cached

    const laemChabang = feed.features.find((f) => f.source === "air4thai:32t");
    expect(laemChabang).toBeDefined();
    expect(laemChabang?.pm25).toBeNull();
    expect(laemChabang?.aqi).toBeNull();
    expect(laemChabang?.category).toBeNull();
  });
});
