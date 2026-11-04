import { createHash, randomBytes } from "node:crypto";
import type { CatalogItem } from "@sijil/shared";
import { pool } from "./db.js";
import { hashPassword, verifyPassword } from "./password.js";

export type SellerRow = {
  id: string;
  email: string;
  shopName: string;
  extractFields: string[];
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function mapSeller(row: {
  id: string;
  email: string;
  shop_name: string;
  extract_fields: string[];
}): SellerRow {
  return {
    id: row.id,
    email: row.email,
    shopName: row.shop_name,
    extractFields: row.extract_fields,
  };
}

export async function createSeller(input: {
  email: string;
  password: string;
  shopName: string;
}): Promise<SellerRow> {
  const passwordHash = await hashPassword(input.password);
  const result = await pool.query<{
    id: string;
    email: string;
    shop_name: string;
    extract_fields: string[];
  }>(
    `insert into sellers (email, password_hash, shop_name)
     values ($1, $2, $3)
     returning id, email, shop_name, extract_fields`,
    [input.email, passwordHash, input.shopName],
  );
  const row = result.rows[0];
  if (!row) throw new Error("seller insert returned no row");
  return mapSeller(row);
}

export async function loginSeller(email: string, password: string): Promise<SellerRow | null> {
  const result = await pool.query<{
    id: string;
    email: string;
    shop_name: string;
    extract_fields: string[];
    password_hash: string;
  }>(
    `select id, email, shop_name, extract_fields, password_hash
     from sellers where email = $1`,
    [email],
  );
  const row = result.rows[0];
  if (!row) return null;
  const matches = await verifyPassword(password, row.password_hash);
  if (!matches) return null;
  return mapSeller(row);
}

export async function openSession(sellerId: string): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await pool.query(
    `insert into sessions (token_hash, seller_id, expires_at)
     values ($1, $2, now() + interval '14 days')`,
    [hashToken(token), sellerId],
  );
  return token;
}

export async function sellerByToken(token: string): Promise<SellerRow | null> {
  const result = await pool.query<{
    id: string;
    email: string;
    shop_name: string;
    extract_fields: string[];
  }>(
    `select s.id, s.email, s.shop_name, s.extract_fields
     from sessions n
     join sellers s on s.id = n.seller_id
     where n.token_hash = $1 and n.expires_at > now()`,
    [hashToken(token)],
  );
  const row = result.rows[0];
  return row ? mapSeller(row) : null;
}

export async function closeSession(token: string): Promise<void> {
  await pool.query(`delete from sessions where token_hash = $1`, [hashToken(token)]);
}

export async function saveExtractFields(sellerId: string, fields: string[]): Promise<void> {
  await pool.query(`update sellers set extract_fields = $2 where id = $1`, [sellerId, fields]);
}

export type ProductRow = {
  id: string;
  name: string;
  aliases: string[];
  price: number;
  hasImage: boolean;
};

export async function listProducts(sellerId: string): Promise<ProductRow[]> {
  const result = await pool.query<{
    id: string;
    name: string;
    aliases: string[];
    price: string;
    has_image: boolean;
  }>(
    `select id, name, aliases, price::text, image_bytes is not null as has_image
     from products where seller_id = $1 order by created_at`,
    [sellerId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    price: Number(row.price),
    hasImage: row.has_image,
  }));
}

export function toCatalog(products: readonly ProductRow[]): CatalogItem[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    aliases: product.aliases,
    price: product.price,
  }));
}

export async function addProduct(input: {
  sellerId: string;
  name: string;
  aliases: string[];
  price: number;
  image: { bytes: Buffer; type: string } | null;
}): Promise<ProductRow> {
  const result = await pool.query<{ id: string }>(
    `insert into products (seller_id, name, aliases, price, image_bytes, image_type)
     values ($1, $2, $3, $4, $5, $6)
     returning id`,
    [
      input.sellerId,
      input.name,
      input.aliases,
      input.price,
      input.image?.bytes ?? null,
      input.image?.type ?? null,
    ],
  );
  const id = result.rows[0]?.id;
  if (!id) throw new Error("product insert returned no row");
  return { id, name: input.name, aliases: input.aliases, price: input.price, hasImage: input.image !== null };
}

export async function updateProduct(input: {
  sellerId: string;
  productId: string;
  name: string;
  aliases: string[];
  price: number;
  image: { bytes: Buffer; type: string } | null;
}): Promise<ProductRow | null> {
  const result = await pool.query<{ id: string; has_image: boolean }>(
    `update products
     set name = $3,
         aliases = $4,
         price = $5,
         image_bytes = case when $6::bytea is null then image_bytes else $6 end,
         image_type = case when $7::text is null then image_type else $7 end
     where id = $1 and seller_id = $2
     returning id, image_bytes is not null as has_image`,
    [
      input.productId,
      input.sellerId,
      input.name,
      input.aliases,
      input.price,
      input.image?.bytes ?? null,
      input.image?.type ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return { id: row.id, name: input.name, aliases: input.aliases, price: input.price, hasImage: row.has_image };
}

export async function deleteProduct(sellerId: string, productId: string): Promise<boolean> {
  const result = await pool.query(`delete from products where id = $1 and seller_id = $2`, [
    productId,
    sellerId,
  ]);
  return (result.rowCount ?? 0) > 0;
}

export async function productImage(
  sellerId: string,
  productId: string,
): Promise<{ bytes: Buffer; type: string } | null> {
  const result = await pool.query<{ image_bytes: Buffer | null; image_type: string | null }>(
    `select image_bytes, image_type from products where id = $1 and seller_id = $2`,
    [productId, sellerId],
  );
  const row = result.rows[0];
  if (!row?.image_bytes || !row.image_type) return null;
  return { bytes: row.image_bytes, type: row.image_type };
}
