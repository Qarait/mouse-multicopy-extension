const { spawn } = require("node:child_process");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const extensionDir = __dirname;
const runtimeFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.js",
  "popup.css",
  "welcome.html"
];

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Mouse MultiCopy Real Browser Fixture</title></head>
        <body>
          <p>Real browser fixture text for Mouse MultiCopy.</p>
          <textarea id="target"></textarea>
        </body>
      </html>`);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const profileDir = path.join("C:\\tmp", `mmc-real-browser-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const loadDir = path.join("C:\\tmp", `mmc-extension-load-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await copyRuntimeExtension(loadDir);

  const fixtureUrl = `http://127.0.0.1:${server.address().port}/fixture`;
  const chromeLoadDir = toChromePath(loadDir);
  const child = spawn(chromePath, [
    `--user-data-dir=${profileDir}`,
    `--disable-extensions-except=${chromeLoadDir}`,
    `--load-extension=${chromeLoadDir}`,
    "--remote-debugging-port=0",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-popup-blocking",
    fixtureUrl
  ], {
    windowsHide: true
  });

  let stderr = "";
  let chromeClosed = false;
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  child.on("exit", () => {
    chromeClosed = true;
  });

  let exitCode = 1;
  try {
    const activePortPath = path.join(profileDir, "DevToolsActivePort");
    const [port, browserWsPath] = (await waitForTextFile(activePortPath, 10000)).trim().split(/\r?\n/);
    const browserClient = await createCdpClient(`ws://127.0.0.1:${port}${browserWsPath}`);
    const page = await waitForPage(port, fixtureUrl, 10000);
    const client = await createCdpClient(page.webSocketDebuggerUrl);
    const targetInfo = await browserClient.send("Target.getTargets");
    const targets = targetInfo.targetInfos.map((target) => ({
      type: target.type,
      title: target.title,
      url: target.url
    }));

    let value = null;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const result = await client.send("Runtime.evaluate", {
        expression: `({
          hasWidget: Boolean(document.getElementById("mmc-widget")),
          toggleText: document.getElementById("mmc-toggle")?.textContent || null,
          title: document.title
        })`,
        returnByValue: true
      });

      value = result.result.value;
      if (value.hasWidget) {
        break;
      }
      await wait(250);
    }

    console.log(JSON.stringify({
      ok: Boolean(value?.hasWidget),
      value,
      fixtureUrl,
      targets,
      stderr: stderr.slice(0, 800)
    }, null, 2));

    exitCode = value?.hasWidget ? 0 : 1;
    try {
      await browserClient.send("Browser.close");
    } catch (_error) {
      child.kill();
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    if (!chromeClosed) {
      child.kill();
      await wait(500);
    }
    await cleanupTempDir(profileDir, "mmc-real-browser-test-");
    await cleanupTempDir(loadDir, "mmc-extension-load-");
    process.exitCode = exitCode;
  }
}

async function copyRuntimeExtension(destination) {
  await fsp.mkdir(destination, { recursive: true });

  for (const file of runtimeFiles) {
    await fsp.copyFile(path.join(extensionDir, file), path.join(destination, file));
  }

  await fsp.cp(path.join(extensionDir, "icons"), path.join(destination, "icons"), { recursive: true });
}

async function waitForTextFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await fsp.readFile(filePath, "utf8");
    } catch (_error) {
      await wait(100);
    }
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}

async function waitForPage(port, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const pages = await fetchJson(`http://127.0.0.1:${port}/json/list`);
      const page = pages.find((candidate) => candidate.url === url && candidate.type === "page");
      if (page) {
        return page;
      }
    } catch (_error) {
      // Chrome may not be ready yet.
    }

    await wait(150);
  }
  throw new Error("Timed out waiting for fixture page in Chrome.");
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    }).on("error", reject);
  });
}

function createCdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    const pending = new Map();
    let id = 0;

    socket.addEventListener("open", () => {
      resolve({
        send(method, params = {}) {
          id += 1;
          const messageId = id;
          socket.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((innerResolve, innerReject) => {
            pending.set(messageId, { resolve: innerResolve, reject: innerReject });
          });
        }
      });
    });

    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) {
        return;
      }

      const request = pending.get(message.id);
      pending.delete(message.id);

      if (message.error) {
        request.reject(new Error(message.error.message));
      } else {
        request.resolve(message.result);
      }
    });

    socket.addEventListener("error", reject);
  });
}

async function cleanupTempDir(directory, prefix) {
  const resolved = path.resolve(directory);
  const allowed = path.resolve("C:\\tmp");
  if (!resolved.startsWith(allowed) || !path.basename(resolved).startsWith(prefix)) {
    return;
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      if (fs.existsSync(resolved)) {
        await fsp.rm(resolved, { recursive: true, force: true });
      }
      return;
    } catch (_error) {
      await wait(300);
    }
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toChromePath(filePath) {
  return path.resolve(filePath).replace(/\\/g, "/");
}
