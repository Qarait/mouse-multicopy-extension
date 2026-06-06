const { spawn } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const vm = require("node:vm");
const { findChrome, uniqueTempPath, toFileUrl } = require("./test-utils");

const chromePath = findChrome();
const extensionDir = __dirname;
const testPage = toFileUrl(path.join(extensionDir, "test-runner.html"));
const popupTestPage = toFileUrl(path.join(extensionDir, "popup-test.html"));

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const sharedState = runSharedStateHarness();
  const clipboard = await runClipboardHarness();
  const workflow = await runWorkflowHarness();
  const popup = await runPopupHarness();
  const background = await runBackgroundHarness();
  const injection = await runExtensionInjection();
  const ok = sharedState.ok && clipboard.ok && workflow.ok && popup.ok && background.ok;

  console.log(JSON.stringify({
    ok,
    sharedState,
    clipboard,
    workflow,
    popup,
    background,
    extensionInjectionProbe: injection
  }, null, 2));
  process.exit(ok ? 0 : 1);
}

function runSharedStateHarness() {
  const context = {};
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(extensionDir, "state.js"), "utf8"), context);
  const state = context.MouseMultiCopyState.normalizeState({
    maxSlots: 3,
    clips: [
      { text: "One" },
      { text: "Two" },
      { text: "Three" },
      { text: "Four" }
    ]
  });

  return {
    ok: state.clips.length === 3
      && state.clips[0].text === "Two"
      && state.activeGroupId === "default"
      && state.outputFormat === "plain"
      && state.includeSource === false
      && state.includePage === false,
    clips: state.clips.map((clip) => clip.text),
    defaults: {
      outputFormat: state.outputFormat,
      includeSource: state.includeSource,
      includePage: state.includePage
    }
  };
}

async function runClipboardHarness() {
  let selected = false;
  let removed = false;
  let fallbackText = "";
  const textarea = {
    value: "",
    style: {},
    setAttribute() {},
    select() {
      selected = true;
      fallbackText = this.value;
    },
    remove() {
      removed = true;
    }
  };
  const context = {
    navigator: {
      clipboard: {
        async writeText() {
          throw new Error("Primary clipboard unavailable.");
        }
      }
    },
    document: {
      body: { appendChild() {} },
      documentElement: {},
      createElement() { return textarea; },
      execCommand(command) { return command === "copy"; }
    }
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(extensionDir, "clipboard.js"), "utf8"), context);
  await context.MouseMultiCopyClipboard.writeText("fallback text");

  return {
    ok: selected && removed && fallbackText === "fallback text",
    fallbackText
  };
}

async function runPopupHarness() {
  const result = await runChrome([
    `--user-data-dir=${uniqueProfile("mmc-chrome-popup")}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--window-size=420,620",
    "--virtual-time-budget=2500",
    "--dump-dom",
    popupTestPage
  ]);

  const match = result.stdout.match(/<pre id="result" hidden="">([\s\S]*?)<\/pre>/);
  const parsed = match ? JSON.parse(unescapeHtml(match[1])) : null;

  return {
    ok: result.status === 0 && parsed?.status === "pass",
    chromeStatus: result.status,
    result: parsed,
    stderr: result.stderr.slice(0, 800)
  };
}

async function runBackgroundHarness() {
  let storageListener;
  const badge = {};
  const chrome = {
    runtime: {
      onInstalled: { addListener() {} },
      onStartup: { addListener() {} },
      getURL(value) { return value; }
    },
    tabs: {
      create() { return Promise.resolve(); },
      query() { return Promise.resolve([]); },
      sendMessage() { return Promise.resolve(); }
    },
    commands: {
      onCommand: { addListener() {} }
    },
    storage: {
      local: {
        get() { return Promise.resolve({}); }
      },
      onChanged: {
        addListener(listener) {
          storageListener = listener;
        }
      }
    },
    action: {
      async setBadgeBackgroundColor(options) { badge.color = options.color; },
      async setBadgeText(options) { badge.text = options.text; },
      async setTitle(options) { badge.title = options.title; }
    }
  };

  vm.runInNewContext(
    fs.readFileSync(path.join(extensionDir, "background.js"), "utf8"),
    { chrome }
  );

  storageListener({
    mouseMultiCopyState: {
      newValue: {
        activeGroupId: "reading",
        groups: [{ id: "reading", clips: [{}, {}, {}] }],
        clips: [{}, {}, {}]
      }
    }
  }, "local");
  await new Promise((resolve) => setTimeout(resolve, 0));

  return {
    ok: badge.text === "3" && badge.title === "Mouse MultiCopy - 3 saved highlights",
    badge
  };
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
  return uniqueTempPath(prefix);
}

function unescapeHtml(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
