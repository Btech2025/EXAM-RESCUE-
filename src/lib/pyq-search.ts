import { createServerFn } from "@tanstack/react-start";

export interface SearchPYQInput {
  query: string;
  university?: string;
  course?: string;
  subject?: string;
  semester?: string;
  examType?: string;
  topics?: string[];
}

export interface SearchPYQItem {
  title: string;
  url: string;
  snippet: string;
  score?: number;
  isPdf?: boolean;
  domain?: string;
  isAcademicDomain?: boolean;
}

export interface SearchPYQOutput {
  ok: boolean;
  query: string;
  results: SearchPYQItem[];
  error?: string;
}

function checkAcademicDomain(domain: string, university?: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase();
  if (
    d.endsWith(".edu") ||
    d.endsWith(".ac.in") ||
    d.endsWith(".edu.in") ||
    d.includes(".edu.") ||
    d.includes(".ac.")
  ) {
    return true;
  }
  if (university) {
    const uniTokens = university
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    for (const token of uniTokens) {
      if (d.includes(token)) return true;
    }
  }
  return false;
}

export const searchPYQServerFn = createServerFn({ method: "POST" })
  .validator((input: SearchPYQInput) => input)
  .handler(async ({ data }): Promise<SearchPYQOutput> => {
    const apiKey = process.env.TAVILY_API_KEY?.trim();
    const query = data?.query?.trim() || "";

    if (!apiKey) {
      return {
        ok: false,
        query,
        results: [],
        error:
          "TAVILY_API_KEY is not configured on the server. Please configure TAVILY_API_KEY in your Vercel project environment variables (or server environment) to enable live search.",
      };
    }

    if (!query) {
      return {
        ok: false,
        query: "",
        results: [],
        error: "Search query is empty. Please enter your university or subject.",
      };
    }

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          include_raw_content: false,
          max_results: 10,
        }),
      });

      if (!response.ok) {
        let errDetail = "";
        try {
          const errJson = (await response.json()) as { message?: string; detail?: string };
          errDetail = errJson.message || errJson.detail || "";
        } catch {
          errDetail = response.statusText;
        }

        return {
          ok: false,
          query,
          results: [],
          error: `Tavily Search API request failed (${response.status}): ${errDetail || "Unknown error"}`,
        };
      }

      const json = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          score?: number;
        }>;
      };

      const rawResults = json.results || [];
      const items: SearchPYQItem[] = rawResults
        .filter((r) => r.url && typeof r.url === "string")
        .map((r) => {
          const url = r.url!;
          let domain = "";
          try {
            domain = new URL(url).hostname;
          } catch {
            domain = "";
          }

          const isPdf =
            url.toLowerCase().endsWith(".pdf") ||
            url.toLowerCase().includes(".pdf?") ||
            (typeof r.title === "string" && r.title.toLowerCase().includes("pdf"));

          const isAcademic = checkAcademicDomain(domain, data.university);

          return {
            title: r.title?.trim() || "Question Paper Resource",
            url,
            snippet: r.content?.trim() || "",
            score: typeof r.score === "number" ? r.score : undefined,
            isPdf,
            domain,
            isAcademicDomain: isAcademic,
          };
        });

      // Sort to prefer public PYQ PDFs and recognized academic/university sources
      items.sort((a, b) => {
        const weightA = (a.isPdf ? 3 : 0) + (a.isAcademicDomain ? 2 : 0) + (a.score ?? 0);
        const weightB = (b.isPdf ? 3 : 0) + (b.isAcademicDomain ? 2 : 0) + (b.score ?? 0);
        return weightB - weightA;
      });

      return {
        ok: true,
        query,
        results: items,
      };
    } catch (err) {
      return {
        ok: false,
        query,
        results: [],
        error:
          err instanceof Error
            ? `Search connection error: ${err.message}`
            : "An unexpected error occurred while contacting Tavily Search.",
      };
    }
  });
