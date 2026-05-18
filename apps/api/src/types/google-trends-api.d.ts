declare module "google-trends-api" {
  interface TrendsRequest {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    property?: string;
    resolution?: string;
  }
  const api: {
    interestOverTime: (req: TrendsRequest) => Promise<string>;
    interestByRegion: (req: TrendsRequest) => Promise<string>;
    relatedQueries:   (req: TrendsRequest) => Promise<string>;
    relatedTopics:    (req: TrendsRequest) => Promise<string>;
    realTimeTrends:   (req: TrendsRequest) => Promise<string>;
    dailyTrends:      (req: TrendsRequest) => Promise<string>;
  };
  export default api;
}
