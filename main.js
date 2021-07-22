const puppeteer = require("puppeteer");
const fs = require("fs/promises");
const path = require("path");

const { hideHeadless } = require("./stealth");

function parseDataUrl(dataUrl) {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (matches.length !== 3) {
    throw new Error("Could not parse data URL.");
  }
  return { mime: matches[1], buffer: Buffer.from(matches[2], "base64") };
}

async function scrapeURL(url) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await hideHeadless(page);

  await page.setViewport({
    width: 2000,
    height: 3000,
    deviceScaleFactor: 2,
  });

  await page.setCookie({
    name: "RSESSION",
    value:
      "ODJoYmJMQWFDUUpXQko0NWZIRjAzRXNHSHNBNjJ6UHBQdmJ0ZHVxMXExNExoNEZSMlEyYTNhMHNxYzJIWi95dklMdEVHVkx0cy9xZ0VIL1M3dS81RW41dWtMWEFiY29LNUVPUm9SVFBtWHNiRU5MOVovcDBvNkZ1bTFLalh5V0NHaDFnbXZSWE5qc0xSbTVmSVFFZm1hZCtxd0ZGa2lUYnZiUUhJYjFEVW5sYnY5Z0tCdWpndmF3NTZsSjl0MWxNQXdkQXRRT1FNaFpmcFBRN0w2ek5aQitxVWJuNkh5UTdaRjJ1YS9MZ29mbFcxR1Y3cXI5alhkMjczUm5YQUxiaEFXSjR4RkNLYWsxRlNrejBWb3lKMndwUmdyUTltUm51ZktUdWs2b1hpZFRGUG03cjAzSlJiRExvUTM5bFhmOUExOE5JY0NxYjFPUERqY2tnWmZHeG5OUkhOM01sOG8zNW84dlZKZHdubVJMcFZkdzJMaERGN0dXTFBrQ1B0SU9hLS1QTUZLdFlibC9wakJEcnZMRjhneXRRPT0%3D--a93830c14aae36f065ce5f602651f40d9e03a142",
    domain: "www.lezhinus.com",
    path: "/",
  });

  const folderName = url.substring(url.indexOf("comic/")).split("/").join("-");
  const folderPath = path.resolve(__dirname, `./dist/${folderName}`);
  await fs.mkdir(folderPath, { recursive: true });

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("https://cdn.lezhin.com/v2/")) {
      const optimizedUrl = url.replace("webp", "jpg").replace("q=30", "q=100");
      console.log("OPTIMIZED URL", optimizedUrl);
      request.continue({ url: optimizedUrl });
    } else {
      request.continue();
    }
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (url.startsWith("https://cdn.lezhin.com/v2/")) {
      const buffer = await response.buffer();
      const fileName = url.split("/").pop().split("#")[0].split("?")[0];
      await fs.writeFile(
        `${folderPath}/${fileName.replace("webp", "jpg")}`,
        buffer
      );
    }
  });

  await page.goto(url);

  // Wait for page to load
  const scrollListSelector = "#scroll-list";
  await page.waitForFunction(
    (selector) => {
      const el = document.querySelector(selector);
      return el != null && el.children.length > 0;
    },
    {},
    scrollListSelector
  );

  const imagesCount = await page.evaluate((selector) => {
    const el = document.querySelector(selector);
    return el.children.length;
  }, scrollListSelector);
  const imageURLs = [...Array(imagesCount)].map(() => null);
  while (imageURLs[imagesCount - 1] == null) {
    const imageURLByIndex = await page.evaluate((selector) => {
      const scrollList = document.querySelector(selector);
      const map = {};
      for (let i = 0; i < scrollList.children.length; i++) {
        const entry = scrollList.children[i];
        if (entry.children.length > 0) {
          const image = entry.firstElementChild;
          map[i] = image.src;
        }
      }
      window.scrollBy(0, 500);
      return map;
    }, scrollListSelector);
    for (const [index, url] of Object.entries(imageURLByIndex)) {
      if (imageURLs[index] == null) {
        imageURLs[index] = url;
      }
    }
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1000);

  await browser.close();
}

(async () => {
  for (let i = 65; i <= 75; i++) {
    await scrapeURL(`https://www.lezhinus.com/en/comic/bodygood/${i}`);
  }
})();
