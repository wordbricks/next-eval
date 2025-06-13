import puppeteer from "puppeteer-core";

/**
 * Launches a configured Puppeteer browser instance
 * @returns Promise that resolves to a Puppeteer browser instance
 */
export const launchBrowser = async () => {
  return await puppeteer.launch({
    defaultViewport: { width: 1920, height: 1080 },
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: false,
  });
};
