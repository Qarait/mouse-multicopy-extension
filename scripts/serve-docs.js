const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..", "docs");
const port = Number(process.env.PORT || 4173);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png"
};

http
  .createServer((request, response) => {
    const requestPath = request.url === "/" ? "/index.html" : request.url;
    const filePath = path.resolve(root, `.${requestPath.split("?")[0]}`);

    if (!filePath.startsWith(root)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(error.code === "ENOENT" ? 404 : 500);
        response.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      response.writeHead(200, {
        "Content-Type":
          contentTypes[path.extname(filePath).toLowerCase()] ||
          "application/octet-stream"
      });
      response.end(data);
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Mouse MultiCopy website: http://127.0.0.1:${port}`);
  });
