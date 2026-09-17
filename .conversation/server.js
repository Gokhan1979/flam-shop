const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

let products = [
  {
    id: "fm-001",
    name: "Flame Logo Tee",
    category: "T-shirts",
    price: 38,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85",
    badge: "Bestseller",
    description: "Heavyweight cotton tee with the signature FLAM chest mark.",
    stock: 24,
  },
  {
    id: "fm-002",
    name: "Ash Oversized Hoodie",
    category: "Hoodies",
    price: 78,
    image: "https://images.unsplash.com/photo-1556821840-3a63f95609a7?auto=format&fit=crop&w=900&q=85",
    badge: "New",
    description: "Relaxed brushed fleece hoodie in a washed charcoal finish.",
    stock: 13,
  },
  {
    id: "fm-003",
    name: "Inferno Track Jacket",
    category: "Outerwear",
    price: 112,
    image: "https://images.unsplash.com/photo-1544966503-7cc5ac882d5f?auto=format&fit=crop&w=900&q=85",
    badge: "Limited",
    description: "A lightweight statement layer cut for late-night city miles.",
    stock: 8,
  },
  {
    id: "fm-004",
    name: "Ember Cargo Pant",
    category: "Bottoms",
    price: 84,
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=85",
    badge: "",
    description: "Utility cargo trousers with a straight leg and adjustable hem.",
    stock: 19,
  },
  {
    id: "fm-005",
    name: "Heatwave Cap",
    category: "Accessories",
    price: 32,
    image: "https://images.unsplash.com/photo-1521369909029-2afed882baee?auto=format&fit=crop&w=900&q=85",
    badge: "",
    description: "Six-panel cotton cap finished with an embroidered flame icon.",
    stock: 31,
  },
  {
    id: "fm-006",
    name: "Afterglow Crewneck",
    category: "Sweatshirts",
    price: 68,
    image: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=900&q=85",
    badge: "New",
    description: "Soft everyday crewneck with contrast ribbing and back print.",
    stock: 16,
  },
];

const orders = [];

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body is too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function productFromInput(input, existing = {}) {
  return {
    id: existing.id || input.id || `fm-${Date.now()}`,
    name: String(input.name || existing.name || "Untitled product").trim(),
    category: String(input.category || existing.category || "New arrivals").trim(),
    price: Math.max(0, Number(input.price ?? existing.price ?? 0)),
    image: String(input.image || existing.image || "").trim(),
    badge: String(input.badge ?? existing.badge ?? "").trim(),
    description: String(input.description || existing.description || "").trim(),
    stock: Math.max(0, Math.floor(Number(input.stock ?? existing.stock ?? 0))),
  };
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/products") {
    return sendJson(res, 200, { products });
  }

  if (req.method === "GET" && url.pathname === "/api/orders") {
    return sendJson(res, 200, { orders });
  }

  if (req.method === "POST" && url.pathname === "/api/orders") {
    try {
      const body = await readBody(req);
      if (!Array.isArray(body.items) || body.items.length === 0) {
        return sendJson(res, 400, { error: "Your basket is empty." });
      }
      const order = {
        id: `FLAM-${String(Date.now()).slice(-6)}`,
        createdAt: new Date().toISOString(),
        customer: body.customer || {},
        items: body.items,
        total: Number(body.total) || 0,
        status: "New",
      };
      orders.unshift(order);
      return sendJson(res, 201, { order });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  if (req.method === "POST" && url.pathname === "/api/products") {
    try {
      const body = await readBody(req);
      const product = productFromInput(body);
      products.unshift(product);
      return sendJson(res, 201, { product });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch) {
    const id = decodeURIComponent(productMatch[1]);
    const index = products.findIndex((product) => product.id === id);
    if (index === -1) return sendJson(res, 404, { error: "Product not found." });

    if (req.method === "PUT") {
      try {
        const body = await readBody(req);
        products[index] = productFromInput(body, products[index]);
        return sendJson(res, 200, { product: products[index] });
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }
    }

    if (req.method === "DELETE") {
      const [deleted] = products.splice(index, 1);
      return sendJson(res, 200, { product: deleted });
    }
  }

  sendJson(res, 404, { error: "API route not found." });
}

function serveStatic(req, res, url) {
  let requested = url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    requested = decodeURIComponent(requested);
  } catch {
    res.writeHead(400);
    return res.end("Bad request");
  }

  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
    };
    res.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) return handleApi(req, res, url);
  serveStatic(req, res, url);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`FLAM MODE is running on http://localhost:${PORT}`);
});