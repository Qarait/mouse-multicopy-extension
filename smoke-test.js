const { spawn } = require("node:child_process");
const http = require("node:http");
const path = require("node:path");

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const extensionDir = __dirname;
const testPage = toFileUrl(path.join(extensionDir, "test-runner.html"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const workflow = await runWorkflowHarness();
  const injection = await runExtensionInjection();
  const ok = workflow.ok;

  console.log(JSON.stringify({ ok, workflow, extensionInjectionProbe: injection }, null, 2));
  process.exit(ok ? 0 : 1);
}

async function runWorkflowHarness() {
  const result = await runChrome([
    `--user-data-dir=${uniqueProfile("mmc-chrome-workflow")}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--virtual-time-budget=4000",
    "--dump-dom",
    testPage
  ]);

  const match = result.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/);
  const parsed = match ? JSON.parse(unescapeHtml(match[1])) : null;

  return {
    ok: result.status === 0 && parsed?.status === "pass",
    chromeStatus: result.status,
    result: parsed,
    stderr: result.stderr.slice(0, 800)
  };
}

async function runExtensionInjection() {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(`<!doctype html>
      <html lang="en">
        <head><title>Mouse MultiCopy Fixture</title></head>
        <body>
          <p>Fixture text for extension injection.</p>
          <textarea></textarea>
        </body>
      </html>`);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    const result = await runChrome([
      `--user-data-dir=${uniqueProfile("mmc-chrome-extension")}`,
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
      "--virtual-time-budget=2500",
      "--dump-dom",
      `http://127.0.0.1:${port}/fixture`
    ]);

    return {
      ok: result.status === 0 && result.stdout.includes("mmc-widget"),
      chromeStatus: result.status,
      widgetInjected: result.stdout.includes("mmc-widget"),
      stderr: result.stderr.slice(0, 800)
    };
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

function runChrome(args) {
  return new Promise((resolve) => {
    const child = spawn(chromePath, args, { windowsHide: true });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (status, signal) => {
      resolve({ status, signal, stdout, stderr });
    });
  });
}

function uniqueProfile(prefix) {
  return path.join("C:\\tmp", `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function toFileUrl(filePath) {
  return `file:///${filePath.replace(/\\/g, "/").replace(/ /g, "%20")}`;
}

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
