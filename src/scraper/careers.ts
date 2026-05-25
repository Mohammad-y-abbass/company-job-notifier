import type { BrowserContext, Page } from "playwright";
import crypto from "crypto";
import { CONFIG, type ScrapeResult } from "../config.js";

export class CareersScraper {
  /**
   * Navigates to a company careers page, sanitizes the content, and computes a unique content hash.
   */
  async scrape(context: BrowserContext, companyWebsite: string): Promise<ScrapeResult> {
    const page = await context.newPage();
    const urls = this.buildCareersUrlCandidates(companyWebsite);
    await this.blockVisualAssets(page);
    let currentUrl = urls[0] ?? companyWebsite;
    let lastError = "";

    try {
      for (const url of urls) {
        currentUrl = url;
        console.log(`[Careers] Loading page safely: ${url}`);

        try {
          // Navigate and wait until network connections drop to zero (crucial for SPAs)
          await page.goto(url, {
            waitUntil: "networkidle",
            timeout: 45000,
          });
          lastError = "";
          break;
        } catch (error: any) {
          lastError = error.message;
          console.warn(`[Careers Retry] ${url} failed: ${lastError}`);
        }
      }

      if (lastError) {
        return {
          success: false,
          error: lastError,
        };
      }

      // Inject a short delay to allow background DOM animations/hydration to settle
      await page.waitForTimeout(2000);

      // Extract the visible inner text of the body element directly inside the browser context
      const cleanContent = await page.evaluate(() => {
        // 1. Remove script tags, style sheets, SVG paths, and hidden elements that contain volatile metadata
        const selectorsToRemove = [
          "script",
          "style",
          "svg",
          "noscript",
          "iframe",
          "header",
          "footer",
          "[hidden]",
        ];
        selectorsToRemove.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => el.remove());
        });

        // 2. Return clean, visible inner text
        return document.body.innerText || "";
      });

      if (!cleanContent.trim()) {
        return {
          success: false,
          error: "Extracted careers content block was completely empty.",
        };
      }

      // Compute a clean, deterministic SHA-256 hash string
      const computedHash = this.generateNormalizedHash(cleanContent);

      return {
        success: true,
        hash: computedHash,
      };
    } catch (error: any) {
      console.error(
        `[Careers Exception] Error evaluating domain ${currentUrl}:`,
        error.message,
      );
      return {
        success: false,
        error: error.message,
      };
    } finally {
      // Ensure the worker tab closes cleanly to reclaim system resources
      await page.close();
    }
  }

  /**
   * Normalizes layout variations and returns a consistent SHA-256 hash
   */
  private generateNormalizedHash(text: string): string {
    const normalized = text
      .toLowerCase() // Disregard casing changes
      .replace(/\s+/g, " ") // Collapse all erratic whitespace and newlines to a single space
      .trim();

    return crypto.createHash("sha256").update(normalized).digest("hex");
  }

  /**
   * Keeps data.json focused on the company's main website while this scraper
   * derives the page it actually needs to inspect.
   */
  private buildCareersUrlCandidates(companyWebsite: string): string[] {
    const websiteWithProtocol = /^https?:\/\//i.test(companyWebsite)
      ? companyWebsite
      : `https://${companyWebsite}`;
    const homepageUrl = new URL(websiteWithProtocol);
    const hosts = new Set([
      homepageUrl.hostname,
      homepageUrl.hostname.startsWith("www.")
        ? homepageUrl.hostname.replace(/^www\./, "")
        : `www.${homepageUrl.hostname}`,
    ]);
    const protocols = homepageUrl.protocol === "http:" ? ["http:", "https:"] : ["https:", "http:"];
    const urls: string[] = [];

    for (const protocol of protocols) {
      for (const host of hosts) {
        const origin = `${protocol}//${host}`;
        urls.push(new URL(CONFIG.CAREERS_PATH, origin).toString());
      }
    }

    return urls;
  }

  private async blockVisualAssets(page: Page): Promise<void> {
    await page.route("**/*", (route) => {
      const resourceType = route.request().resourceType();

      if (["image", "media", "font", "stylesheet"].includes(resourceType)) {
        return route.abort();
      }

      return route.continue();
    });
  }
}
