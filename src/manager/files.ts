import fs from "fs";
import { type Company, CONFIG } from "../config.js";

export class DataManager {
  private companiesCache: Company[] = [];

  /**
   * Reads, parses, and validates the local data.json tracking file
   */
  public loadCompanies(): Company[] {
    if (!fs.existsSync(CONFIG.DATA_FILE_PATH)) {
      throw new Error(
        `Critical Error: State tracking file missing at ${CONFIG.DATA_FILE_PATH}. Please initialize it.`,
      );
    }

    try {
      const fileRaw = fs.readFileSync(CONFIG.DATA_FILE_PATH, "utf-8");
      this.companiesCache = JSON.parse(fileRaw) as Company[];
      return this.companiesCache;
    } catch (error: any) {
      throw new Error(`Critical Error parsing data.json: ${error.message}`);
    }
  }

  /**
   * Updates an isolated company state record inside memory cache
   */
  public updateCompanyState(updatedCompany: Company): void {
    const index = this.companiesCache.findIndex(
      (c) => c.id === updatedCompany.id,
    );
    if (index !== -1) {
      this.companiesCache[index] = updatedCompany;
    }
  }

  /**
   * Executes an atomic write operation to disk.
   * Writing to a temporary file and renaming it prevents file corruption if the process crashes.
   */
  public saveChangesToDisk(): void {
    const tempPath = `${CONFIG.DATA_FILE_PATH}.tmp`;

    try {
      // 1. Serialize memory cache to clean formatted JSON string data
      const serializedData = JSON.stringify(this.companiesCache, null, 2);

      // 2. Write content out to target placeholder file
      fs.writeFileSync(tempPath, serializedData, "utf-8");

      // 3. Atomically overwrite standard database file with complete validation structure
      fs.renameSync(tempPath, CONFIG.DATA_FILE_PATH);
    } catch (error: any) {
      console.error(
        `[Data Storage Exception] Atomic file-flush operation failed:`,
        error.message,
      );

      // Cleanup temporary placeholder file artifact if still lingering
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
      }
    }
  }
}
