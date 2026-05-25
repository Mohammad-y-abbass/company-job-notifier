import type { BrowserContext, Page } from "playwright";
import crypto from "crypto";
import { CONFIG, type ScrapeResult } from "../config.js";

type LinkedInFeed = "posts" | "jobs";

export class LinkedInScraper {
  /**
   * Targets company post and job feeds via an authenticated browser context.
   */
  async scrape(
    context: BrowserContext,
    companyUrl: string,
    progressLabel = "LinkedIn",
  ): Promise<ScrapeResult> {
    const page = await context.newPage();
    await this.blockVisualAssets(page);

    try {
      // 1. Inject the authentication token cookie directly into this isolated context
      await context.addCookies([
        {
          name: "li_at",
          value: CONFIG.LINKEDIN_COOKIE,
          domain: ".www.linkedin.com",
          path: "/",
          httpOnly: true,
          secure: true,
        },
      ]);

      const feedUrls = this.buildFeedUrls(companyUrl);

      console.log(`[${progressLabel}] Accessing posts feed: ${feedUrls.posts}`);
      const postsPayload = await this.scrapeFeed(page, feedUrls.posts, "posts");

      console.log(`[${progressLabel}] Accessing jobs feed: ${feedUrls.jobs}`);
      const jobsPayload = await this.scrapeFeed(page, feedUrls.jobs, "jobs");

      const finalPayload = [
        `posts:${postsPayload}`,
        `jobs:${jobsPayload}`,
      ].join("\n===LINKEDIN_FEED_BREAK===\n");
      const computedHash = crypto
        .createHash("sha256")
        .update(finalPayload.toLowerCase().replace(/\s+/g, " ").trim())
        .digest("hex");

      return {
        success: true,
        hash: computedHash,
      };
    } catch (error: any) {
      console.error(
        `[LinkedIn Exception] Target failed on ${companyUrl}:`,
        error.message,
      );
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // Cleanly dispose of the worker page tab allocation
      await page.close();
    }
  }

  private async scrapeFeed(
    page: Page,
    url: string,
    feed: LinkedInFeed,
  ): Promise<string> {
    // Navigate using 'domcontentloaded' to beat slow-rendering heavy images
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 40000,
    });

    // Give dynamic components time to hydrate and settle down safely
    await page.waitForTimeout(5000);

    this.assertAuthenticated(page);

    const feedPayload = await page.evaluate((targetFeed) => {
      const selectorMap: Record<LinkedInFeed, string[]> = {
        posts: [
          ".update-components-text",
          ".feed-shared-update-v2__commentary",
          ".text-view_text",
        ],
        jobs: [
          ".jobs-search-results-list",
          ".job-card-list__title",
          ".job-card-container",
          ".jobs-company__box",
          ".jobs-unified-top-card",
        ],
      };

      const combinedText: string[] = [];

      selectorMap[targetFeed].forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          const inner = (el as HTMLElement).innerText;
          if (inner) combinedText.push(inner.trim());
        });
      });

      return combinedText.join("\n---\n");
    }, feed);

    return feedPayload.trim() || `no_recent_${feed}_visible`;
  }

  private assertAuthenticated(page: Page): void {
    const currentUrl = page.url();
    if (
      currentUrl.includes("checkpoint/challenge") ||
      currentUrl.includes("login")
    ) {
      throw new Error(
        "Authentication bypassed. LinkedIn triggered a verification wall or expired your cookie.",
      );
    }
  }

  private buildFeedUrls(companyUrl: string): Record<LinkedInFeed, string> {
    const linkedinUrl = /^https?:\/\//i.test(companyUrl)
      ? companyUrl
      : `https://${companyUrl}`;
    const url = new URL(linkedinUrl);
    const pathParts = url.pathname
      .split("/")
      .filter(Boolean)
      .filter((part) => !["posts", "jobs"].includes(part.toLowerCase()));
    const basePath = `/${pathParts.join("/")}/`;
    const baseCompanyUrl = new URL(basePath, url.origin);

    return {
      posts: new URL(CONFIG.LINKEDIN_POSTS_PATH, baseCompanyUrl).toString(),
      jobs: new URL(CONFIG.LINKEDIN_JOBS_PATH, baseCompanyUrl).toString(),
    };
  }

  private async blockVisualAssets(page: Page): Promise<void> {
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();

      if (["image", "media", "font"].includes(resourceType)) {
        return route.abort();
      }

      return route.continue();
    });
  }
}
