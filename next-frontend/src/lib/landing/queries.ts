import { useQuery } from "@tanstack/react-query";
import { colleges, type CampusEvent, type Club, type College } from "./data";

export const queryKeys = {
  all: ["4thepeople"] as const,
  colleges: () => [...queryKeys.all, "colleges"] as const,
  college: (slug: string) => [...queryKeys.all, "college", slug] as const,
  events: (collegeId: string) => [...queryKeys.all, "events", collegeId] as const,
  clubs: (collegeId: string) => [...queryKeys.all, "clubs", collegeId] as const,
};

export function useColleges() {
  return useQuery({
    queryKey: queryKeys.colleges(),
    queryFn: async (): Promise<College[]> => colleges,
  });
}

export function useCollegeEvents(collegeId: string) {
  return useQuery<CampusEvent[]>({
    queryKey: queryKeys.events(collegeId),
    queryFn: async (): Promise<CampusEvent[]> =>
      colleges
        .find((c) => c.slug === collegeId)
        ?.events.filter((e) => e.status !== "past")
        .map((e) => ({ ...e })) ?? [],
  });
}

export function useCollegeClubs(collegeId: string) {
  return useQuery<Club[]>({
    queryKey: queryKeys.clubs(collegeId),
    queryFn: async (): Promise<Club[]> =>
      colleges
        .find((c) => c.slug === collegeId)
        ?.clubs.map((c) => ({ ...c })) ?? [],
  });
}

