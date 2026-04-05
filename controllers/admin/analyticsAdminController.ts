import { getAdminAnalyticsCached } from "@/services/adminAnalyticsService";

export const analyticsAdmin = {
  getBundle: () => getAdminAnalyticsCached(),
};
