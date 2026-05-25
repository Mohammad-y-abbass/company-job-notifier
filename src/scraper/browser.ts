import { chromium } from "playwright-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, BrowserContext } from "playwright";

// Inject the stealth plugin directly into the playwright-extra chromium launcher
chromium.use(stealthPlugin());

/**
 * Orchestrates secure browser instances and isolates sessions
 */
export class BrowserManager {
  private browser: Browser | null = null;

  /**
   * Initializes the shared headful/headless browser process
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: process.env.HEADLESS_BROWSER !== "false",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled", // Blocks deep automation flags
        "--window-size=1280,800",
      ],
    });
  }

  /**
   * Generates an isolated browser context with randomized fingerprint overrides
   */
  async createStealthContext(): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error(
        "Browser process not initialized. Run initialize() first.",
      );
    }

    // List of common user agents to cycle through, reducing structural footprint tracking
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    ];
    const randomUserAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];

    const context = await this.browser.newContext({
      userAgent: randomUserAgent as string,
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      locale: "en-US",
      timezoneId: "America/New_York",
    });

    // CRITICAL: Evade in-page bot tests by deleting the automation flag at runtime initialization
    await context.addInitScript(() => {
      // Hard delete the standard automated flag
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Mock chrome runtime plugin arrays to look like an organic consumer browser
      (globalThis as any).chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: {},
      };
    });

    return context;
  }

  /**
   * Destroys the primary browser process gracefully
   */
  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}
