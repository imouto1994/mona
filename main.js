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

(async () => {
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
      "WVRnWUY1akxYRmQ4eDk4OEJMMmphZWZ1c1ZtTTByTmQ3UkhYUncyKzBkSHlsRytZajNybWVoQjJ2aGlXU1UwS3Ezc3MrN2JWci81dHVXUU8rcXppKzJFSHlIOVRMcmNwU0ZnRFo5dE1kek5vZCtLQUtkYU5TYTRHNWJXb1YrWElUb2E0aWlzalp2RUpGd3dya1pwWk1nMmxZeDBRWlhmdklFd3BXL0x2UHRwekFXKzUzWUpZWTcvYXNjR0NwSG84NWoxL05xMXdzaG9xc0YvVUxaR2pCeWM1MHowTzI4cklJeUJUWm5FWTV3eXBzcFNtYXZGNHpHWHJjeVNadVk1UHZwa1dlUXFpTEVBWklkQ3ZwbHVEeXB5WkE4ZTJCVk5DUklacmszQThVVlY0UmphczdiRmJDK1pnQzBJR2dhUE1ya0MxRVYzQ0tXS0RDcDBTTnhUS1JUVWJBUy9zZHNpYXVqbzMwbTJ5V2o5SFFiTzdvT2tOWjFKa2NzMFRRakkyLS0vT0Jlc1pSek5zeU9xaDZ1aGJFd3RRPT0%3D--609abb1ee0f62e3b196ba7a60b60250c7d4365b8",
    domain: "www.lezhinus.com",
    path: "/",
  });

  const url = "https://www.lezhinus.com/en/comic/touch_en/5";
  const folderName = url.substring(url.indexOf("comic/")).split("/").join("-");
  const folderPath = path.resolve(__dirname, `./dist/${folderName}`);
  await fs.mkdir(folderPath, { recursive: true });

  await page.setRequestInterception(true);

  page.on("request", (request) => {
    const url = request.url();
    if (url.startsWith("https://cdn.lezhin.com/v2/")) {
      const endIndex = url.indexOf("&");
      const optimizedUrl = url
        .substring(0, endIndex !== -1 ? endIndex : undefined)
        .replace("webp", "jpg");
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
})();
