import { BrowserManager } from "./scraper/browser.js";
import { CareersScraper } from "./scraper/careers.js";
import { LinkedInScraper } from "./scraper/linkedin.js";
import { DataManager } from "./manager/files.js";
import { Notifier } from "./notification/notify.js";
import { type Company, CONFIG } from "./config.js";

/**
 * Helper to halt execution for a specified duration
 */
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Calculates a randomized, natural delay time between boundaries
 */
function getRandomPacingDelay(): number {
  const min = CONFIG.PACING_MIN_MS;
  const max = CONFIG.PACING_MAX_MS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Main application monitoring loop
 */
async function main() {
  const dataManager = new DataManager();
  const notifier = new Notifier();

  const browserManager = new BrowserManager();
  const careersScraper = new CareersScraper();
  const linkedInScraper = new LinkedInScraper();

  try {
    // 1. Load targets out of your local JSON storage file
    console.log(
      "[Engine Init] Parsing localized company tracking definitions...",
    );
    const companies = dataManager.loadCompanies();
    console.log(
      `[Engine Init] Successfully loaded ${companies.length} corporate target maps.\n`,
    );

    // 2. Instantiate the global hidden Chromium browser process
    console.log("[Engine Init] Powering up stealth web automation drivers...");
    await browserManager.initialize();

    // 3. Begin processing the companies sequentially
    for (let i = 0; i < companies.length; i++) {
      const company = companies[i] as Company;
      console.log(
        `================================================================`,
      );
      console.log(
        `▶ [${i + 1} / ${companies.length}] Synchronizing Tracker for: ${company.name}`,
      );
      console.log(
        `================================================================`,
      );

      let isMemoryStateMutated = false;

      // ---------------------------------------------------------
      // Action Channel A: Corporate Careers Page Verification
      // ---------------------------------------------------------
      if (company.website) {
        // Create a completely clean browser context sandbox for this run
        const context = await browserManager.createStealthContext();

        const res = await careersScraper.scrape(context, company.website);
        if (res.success && res.hash) {
          if (res.hash !== company.lastCareersHash) {
            await notifier.notify(
              company,
              "Careers Page",
              company.lastCareersHash ?? "",
              res.hash,
            );
            company.lastCareersHash = res.hash;
            isMemoryStateMutated = true;
          } else {
            console.log(
              `[Careers Check] Content matches current recorded baseline.`,
            );
          }
        }

        // Destroy context to wipe all session footprints, cookies, and localStorage data
        await context.close();
      }

      // Short breathing window between testing internal channels
      await sleep(3000);

      // ---------------------------------------------------------
      // Action Channel B: Authenticated LinkedIn Post Verification
      // ---------------------------------------------------------
      if (company.linkedinUrl) {
        const context = await browserManager.createStealthContext();

        const res = await linkedInScraper.scrape(context, company.linkedinUrl);
        if (res.success && res.hash) {
          if (res.hash !== company.lastLinkedInHash) {
            await notifier.notify(
              company,
              "LinkedIn Feeds",
              company.lastLinkedInHash ?? "",
              res.hash,
            );
            company.lastLinkedInHash = res.hash;
            isMemoryStateMutated = true;
          } else {
            console.log(
              `[LinkedIn Check] Feed text matches current recorded baseline.`,
            );
          }
        } else if (!res.success) {
          console.warn(
            `[LinkedIn Skipped] Tracking bypassed due to error: ${res.error}`,
          );
        }

        await context.close();
      }

      // Update structural runtime markers
      company.lastChecked = new Date().toISOString();
      dataManager.updateCompanyState(company);

      // Save memory changes down atomically immediately after finishing each company
      dataManager.saveChangesToDisk();

      // ---------------------------------------------------------
      // Human-Emulation Cool Down Engine
      // ---------------------------------------------------------
      if (i < companies.length - 1) {
        const structuralDelay = getRandomPacingDelay();
        console.log(
          `\n[Pacing Shield] Sequential run safe. Sleeping for ${(structuralDelay / 1000).toFixed(1)}s before the next target...`,
        );
        await sleep(structuralDelay);
      }
    }

    console.log(
      "\n✅ [Execution Success] All company channels checked and updated seamlessly.",
    );
  } catch (criticalError: any) {
    console.error(
      "\nFATAL SYSTEM EXCEPTION OCCURRED DURING RUNTIME:",
      criticalError.message,
    );
  } finally {
    // 4. Ensure the root browser application instance shuts down cleanly no matter what
    console.log(
      "[Engine Shutdown] Disposing open system automation resources...",
    );
    await browserManager.shutdown();
    console.log("[Engine Shutdown] Execution loop successfully completed.");
  }
}

// Fire runtime
main();
