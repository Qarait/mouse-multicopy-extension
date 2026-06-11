document.getElementById("year").textContent = new Date().getFullYear();

const storeLinks = {
  chrome: "",
  edge: "",
  firefox: ""
};

// Firefox listing after approval:
// https://addons.mozilla.org/en-US/firefox/addon/mouse-multicopy/

function activateStoreButton(selector, url, label) {
  if (!url) {
    return;
  }

  const button = document.querySelector(selector);
  const link = document.createElement("a");
  link.className = button.className;
  link.href = url;
  link.setAttribute("aria-label", label);
  link.innerHTML = button.innerHTML.replace("In review", "Add to browser");
  button.replaceWith(link);
}

activateStoreButton(
  '[data-store="chrome"]',
  storeLinks.chrome,
  "Add Mouse MultiCopy to Google Chrome"
);
activateStoreButton(
  '[data-store="edge"]',
  storeLinks.edge,
  "Get Mouse MultiCopy for Microsoft Edge"
);
activateStoreButton(
  '[data-store="firefox"]',
  storeLinks.firefox,
  "Get Mouse MultiCopy for Firefox"
);
