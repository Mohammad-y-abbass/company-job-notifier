import { CONFIG, type Company } from "../config.js";

type NotificationChannel = "Careers Page" | "LinkedIn Feeds";

export class Notifier {
  /**
   * Evaluates delta modifications and fires system alert notification streams.
   */
  public async notify(
    company: Company,
    channel: NotificationChannel,
    oldHash: string,
    newHash: string,
  ): Promise<void> {
    const isInitialRun = oldHash === "";

    if (isInitialRun) {
      console.log(
        `\n[Initialization] Baseline hash captured for ${company.name} on channel [${channel}].`,
      );
      console.log(`   Hash: ${newHash}`);
      await this.dispatchTelegramNotification(company, channel, "Baseline captured");
      return;
    }

    const timestamp = new Date().toLocaleString();

    console.log(
      `\n[CHANGE DETECTED] ${company.name} updated their ${channel}!`,
    );
    console.log(`   Time:    ${timestamp}`);
    console.log(`   Old Hash: [${oldHash}]`);
    console.log(`   New Hash: [${newHash}]`);

    await this.dispatchTelegramNotification(company, channel, "Change detected");
  }

  private async dispatchTelegramNotification(
    company: Company,
    channel: NotificationChannel,
    title: "Baseline captured" | "Change detected",
  ): Promise<void> {
    if (!CONFIG.TELEGRAM_BOT_TOKEN || !CONFIG.TELEGRAM_CHAT_ID) {
      console.warn(
        "[Telegram Skipped] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing.",
      );
      return;
    }

    const targetUrl =
      channel === "Careers Page" ? company.website : company.linkedinUrl;
    const message = [
      `<b>${title}</b>`,
      `<b>Company:</b> ${this.escapeHtml(company.name)}`,
      `<b>Channel:</b> ${this.escapeHtml(channel)}`,
      `<b>URL:</b> ${targetUrl ? this.escapeHtml(targetUrl) : "Unavailable"}`,
    ].join("\n");

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${CONFIG.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: CONFIG.TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: "HTML",
            disable_web_page_preview: false,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.warn(
          `[Telegram Failed] ${response.status} ${response.statusText}: ${errorBody}`,
        );
        return;
      }

      console.log("[Telegram Sent] Change notification delivered.");
    } catch (error: any) {
      console.warn(`[Telegram Failed] ${error.message}`);
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
