import type { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { defaultExtractFields, isExtractFieldKey } from "@sijil/shared";
import { z } from "zod";
import {
  addProduct,
  closeSession,
  createSeller,
  deleteProduct,
  updateProduct,
  listProducts,
  loginSeller,
  openSession,
  productImage,
  saveExtractFields,
  sellerByToken,
  type SellerRow,
} from "./seller-store.js";

const cookieName = "sijil_session";
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxImageBytes = 700_000;

const signupSchema = z.object({
  shopName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

const fieldsSchema = z.object({
  fields: z.array(z.string()).max(20),
});

export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function cookie(token: string, maxAge: number): string {
  const secure = process.env.WEB_ORIGIN?.startsWith("https://") ?? false;
  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${maxAge}`,
    `SameSite=${secure ? "None" : "Lax"}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

function publicSeller(seller: SellerRow) {
  return {
    id: seller.id,
    email: seller.email,
    shopName: seller.shopName,
    extractFields: seller.extractFields,
  };
}

async function currentSeller(cookieHeader: string | undefined): Promise<SellerRow | null> {
  const token = readCookie(cookieHeader, cookieName);
  if (!token) return null;
  return sellerByToken(token);
}

function databaseDown(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "42P01" || code === "3D000" || code === "ECONNREFUSED" || code === "ENOTFOUND";
}

async function readProductForm(
  body: Record<string, string | File>,
): Promise<
  | { ok: true; value: { name: string; price: number; aliases: string[]; image: { bytes: Buffer; type: string } | null } }
  | { ok: false; error: string; status: 400 | 413 }
> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = typeof body.price === "string" ? Number(body.price) : Number.NaN;
  const aliases =
    typeof body.aliases === "string"
      ? body.aliases
          .split(",")
          .map((alias) => alias.trim())
          .filter((alias) => alias.length > 0)
          .slice(0, 12)
      : [];
  if (!name || !Number.isFinite(price) || price < 0) {
    return { ok: false, error: "Enter a product name and a price.", status: 400 };
  }
  let image: { bytes: Buffer; type: string } | null = null;
  if (body.image instanceof File && body.image.size > 0) {
    if (!imageTypes.has(body.image.type)) return { ok: false, error: "Use a JPEG, PNG, or WebP image.", status: 400 };
    if (body.image.size > maxImageBytes) return { ok: false, error: "Image is too large", status: 413 };
    image = { bytes: Buffer.from(await body.image.arrayBuffer()), type: body.image.type };
  }
  return { ok: true, value: { name, price, aliases, image } };
}

export function mountSeller(app: Hono) {
  app.post("/api/signup", async (c) => {
    const parsed = signupSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Enter a shop name, email, and a password of 8 or more characters." }, 400);
    try {
      const seller = await createSeller({
        email: parsed.data.email.toLowerCase(),
        password: parsed.data.password,
        shopName: parsed.data.shopName,
      });
      const token = await openSession(seller.id);
      c.header("set-cookie", cookie(token, 60 * 60 * 24 * 14));
      return c.json({ seller: publicSeller(seller) });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return c.json({ error: "That email already has a shop." }, 409);
      }
      if (databaseDown(error)) return c.json({ error: "The shop database is not ready." }, 503);
      console.error(error instanceof Error ? error.message : "signup failed");
      return c.json({ error: "Could not create the shop." }, 500);
    }
  });

  app.post("/api/login", async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Enter your email and password." }, 400);
    try {
      const seller = await loginSeller(parsed.data.email.toLowerCase(), parsed.data.password);
      if (!seller) return c.json({ error: "Email or password is wrong." }, 401);
      const token = await openSession(seller.id);
      c.header("set-cookie", cookie(token, 60 * 60 * 24 * 14));
      return c.json({ seller: publicSeller(seller) });
    } catch (error) {
      if (databaseDown(error)) return c.json({ error: "The shop database is not ready." }, 503);
      console.error(error instanceof Error ? error.message : "login failed");
      return c.json({ error: "Could not log in." }, 500);
    }
  });

  app.post("/api/logout", async (c) => {
    const token = readCookie(c.req.header("cookie"), cookieName);
    if (token) {
      try {
        await closeSession(token);
      } catch (error) {
        console.error(error instanceof Error ? error.message : "logout failed");
      }
    }
    c.header("set-cookie", cookie("", 0));
    return c.json({ ok: true });
  });

  app.get("/api/me", async (c) => {
    try {
      const seller = await currentSeller(c.req.header("cookie"));
      if (!seller) return c.json({ seller: null }, 401);
      return c.json({ seller: publicSeller(seller) });
    } catch (error) {
      if (databaseDown(error)) return c.json({ error: "The shop database is not ready." }, 503);
      console.error(error instanceof Error ? error.message : "session lookup failed");
      return c.json({ error: "Could not read the session." }, 500);
    }
  });

  app.get("/api/products", async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const products = await listProducts(seller.id);
    return c.json({ products });
  });

  const productBodyLimit = bodyLimit({
    maxSize: 1_500_000,
    onError: (c) => c.json({ error: "Image is too large" }, 413),
  });

  app.post("/api/products", productBodyLimit, async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const parsed = await readProductForm(await c.req.parseBody());
    if (!parsed.ok) return c.json({ error: parsed.error }, parsed.status);
    const product = await addProduct({ sellerId: seller.id, ...parsed.value });
    return c.json({ product }, 201);
  });

  app.patch("/api/products/:id", productBodyLimit, async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    if (!z.string().uuid().safeParse(c.req.param("id")).success) return c.json({ error: "Product not found." }, 404);
    const parsed = await readProductForm(await c.req.parseBody());
    if (!parsed.ok) return c.json({ error: parsed.error }, parsed.status);
    const product = await updateProduct({ sellerId: seller.id, productId: c.req.param("id"), ...parsed.value });
    if (!product) return c.json({ error: "Product not found." }, 404);
    return c.json({ product });
  });

  app.delete("/api/products/:id", async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const removed = await deleteProduct(seller.id, c.req.param("id"));
    if (!removed) return c.json({ error: "Product not found." }, 404);
    return c.json({ ok: true });
  });

  app.get("/api/products/:id/image", async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const image = await productImage(seller.id, c.req.param("id"));
    if (!image) return c.json({ error: "No image." }, 404);
    return c.body(new Uint8Array(image.bytes), 200, {
      "content-type": image.type,
      "cache-control": "private, max-age=3600",
    });
  });

  app.put("/api/extract-fields", async (c) => {
    const seller = await currentSeller(c.req.header("cookie")).catch(() => null);
    if (!seller) return c.json({ error: "Log in first." }, 401);
    const parsed = fieldsSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "Choose the fields to extract." }, 400);
    const fields = [...new Set(parsed.data.fields.filter(isExtractFieldKey))];
    const next = fields.length > 0 ? fields : [...defaultExtractFields];
    await saveExtractFields(seller.id, next);
    return c.json({ fields: next });
  });
}

export async function sellerForRequest(cookieHeader: string | undefined): Promise<SellerRow | null> {
  if (!process.env.DATABASE_URL) return null;
  const token = readCookie(cookieHeader, cookieName);
  if (!token) return null;
  try {
    return await sellerByToken(token);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "seller lookup failed");
    return null;
  }
}
