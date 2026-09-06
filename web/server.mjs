import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "dist");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
};

function getFilePath(url) {
  const requestedPath = new URL(url, "http://localhost").pathname;
  const path = requestedPath === "/" ? "index.html" : requestedPath.slice(1);
  const filePath = resolve(root, normalize(path));
  return filePath === root || filePath.startsWith(`${root}/`) ? filePath : null;
}

const server = createServer(async (request, response) => {
  const filePath = getFilePath(request.url ?? "/");

  try {
    const file = await readFile(filePath ?? join(root, "index.html"));
    response.writeHead(200, {
      "Content-Type":
        contentTypes[extname(filePath ?? ".html")] ??
        "application/octet-stream",
    });
    response.end(file);
  } catch {
    const fallback = await readFile(join(root, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(fallback);
  }
});

server.listen(Number(process.env.PORT ?? 3000), "0.0.0.0");
