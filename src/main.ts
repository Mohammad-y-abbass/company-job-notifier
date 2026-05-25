import { BrowserManager } from "./scraper/browser.js";
import { CareersScraper } from "./scraper/careers.js";
import { LinkedInScraper } from "./scraper/linkedin.js";
import { DataManager } from "./manager/files.js";
import { Notifier } from "./notification/notify.js";
import { type Company, CONFIG } from "./config.js";

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getRandomPacingDelay(): number {
  const min = CONFIG.PACING_MIN_MS;
  const max = CONFIG.PACING_MAX_MS;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function checkCareersPage(
  company: Company,
  index: number,
  total: number,
  browserManager: BrowserManager,
  careersScraper: CareersScraper,
  notifier: Notifier,
  dataManager: DataManager,
): Promise<void> {
  if (!company.website) return;

  console.log(
    `[Careers ${index + 1}/${total}] Checking ${company.name}`,
  );

  const context = await browserManager.createStealthContext();

  try {
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
      } else {
        console.log(`[Careers Check] ${company.name} matches baseline.`);
      }
    } else if (!res.success) {
      console.warn(
        `[Careers Skipped] ${company.name} failed due to error: ${res.error}`,
      );
    }

    company.lastChecked = new Date().toISOString();
    dataManager.updateCompanyState(company);
    dataManager.saveChangesToDisk();
  } finally {
    await context.close();
  }
}

async function runCareersChecks(
  companies: Company[],
  browserManager: BrowserManager,
  careersScraper: CareersScraper,
  notifier: Notifier,
  dataManager: DataManager,
): Promise<void> {
  let nextIndex = 0;
  const workerCount = Math.min(CONFIG.CAREERS_CONCURRENCY, companies.length);

  async function worker(): Promise<void> {
    while (nextIndex < companies.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const company = companies[currentIndex];

      if (company) {
        await checkCareersPage(
          company,
          currentIndex,
          companies.length,
          browserManager,
          careersScraper,
          notifier,
          dataManager,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      await worker();
    }),
  );
}

async function checkLinkedInFeeds(
  company: Company,
  index: number,
  total: number,
  browserManager: BrowserManager,
  linkedInScraper: LinkedInScraper,
  notifier: Notifier,
  dataManager: DataManager,
): Promise<boolean> {
  if (!company.linkedinUrl) return false;

  console.log(
    `[LinkedIn ${index + 1}/${total}] Checking ${company.name}`,
  );

  const context = await browserManager.createStealthContext();

  try {
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
      } else {
        console.log(`[LinkedIn Check] ${company.name} matches baseline.`);
      }
    } else if (!res.success) {
      console.warn(
        `[LinkedIn Skipped] ${company.name} failed due to error: ${res.error}`,
      );
    }

    company.lastChecked = new Date().toISOString();
    dataManager.updateCompanyState(company);
    dataManager.saveChangesToDisk();
    return true;
  } finally {
    await context.close();
  }
}

async function runLinkedInChecks(
  companies: Company[],
  browserManager: BrowserManager,
  linkedInScraper: LinkedInScraper,
  notifier: Notifier,
  dataManager: DataManager,
): Promise<void> {
  for (let i = 0; i < companies.length; i++) {
    const company = companies[i] as Company;
    const didScrapeLinkedIn = await checkLinkedInFeeds(
      company,
      i,
      companies.length,
      browserManager,
      linkedInScraper,
      notifier,
      dataManager,
    );

    if (didScrapeLinkedIn && i < companies.length - 1) {
      const structuralDelay = getRandomPacingDelay();
      console.log(
        `\n[LinkedIn Pacing] Sleeping for ${(structuralDelay / 1000).toFixed(1)}s before the next LinkedIn target...`,
      );
      await sleep(structuralDelay);
    }
  }
}

async function main() {
  const dataManager = new DataManager();
  const notifier = new Notifier();

  const browserManager = new BrowserManager();
  const careersScraper = new CareersScraper();
  const linkedInScraper = new LinkedInScraper();

  try {
    console.log(
      "[Engine Init] Parsing localized company tracking definitions...",
    );
    const companies = dataManager.loadCompanies();
    console.log(
      `[Engine Init] Successfully loaded ${companies.length} corporate target maps.\n`,
    );

    console.log("[Engine Init] Powering up stealth web automation drivers...");
    await browserManager.initialize();

    console.log(
      `[Engine Run] Starting careers checks with ${CONFIG.CAREERS_CONCURRENCY} parallel workers and LinkedIn checks sequentially.`,
    );

    await Promise.all([
      runCareersChecks(
        companies,
        browserManager,
        careersScraper,
        notifier,
        dataManager,
      ),
      runLinkedInChecks(
        companies,
        browserManager,
        linkedInScraper,
        notifier,
        dataManager,
      ),
    ]);

    console.log(
      "\n[Execution Success] All company channels checked and updated.",
    );
  } catch (criticalError: any) {
    console.error(
      "\nFATAL SYSTEM EXCEPTION OCCURRED DURING RUNTIME:",
      criticalError.message,
    );
  } finally {
    console.log(
      "[Engine Shutdown] Disposing open system automation resources...",
    );
    await browserManager.shutdown();
    console.log("[Engine Shutdown] Execution loop successfully completed.");
  }
}

main();
