import { apiBaseUrl } from "../../lib/config/config.js";
import { errorDetail, getJson, HttpError, postJson } from "../../lib/http/http.js";

export type SellerAccount = {
  id: string;
  email: string;
  shopName: string;
  extractFields: string[];
};

export type ShopProduct = {
  id: string;
  name: string;
  aliases: string[];
  price: number;
  hasImage: boolean;
};

async function readSeller(path: string, body: unknown): Promise<SellerAccount> {
  const payload = await postJson(path, body);
  if (!payload || typeof payload !== "object" || !("seller" in payload)) {
    throw new HttpError(0, null);
  }
  return (payload as { seller: SellerAccount }).seller;
}

export async function loadSeller(): Promise<SellerAccount | null> {
  try {
    const payload = await getJson("/api/me");
    if (!payload || typeof payload !== "object" || !("seller" in payload)) return null;
    const seller = (payload as { seller: SellerAccount | null }).seller;
    return seller;
  } catch (error) {
    if (error instanceof HttpError && (error.status === 401 || error.status === 0)) return null;
    throw error;
  }
}

export function signup(input: { shopName: string; email: string; password: string }): Promise<SellerAccount> {
  return readSeller("/api/signup", input);
}

export function login(input: { email: string; password: string }): Promise<SellerAccount> {
  return readSeller("/api/login", input);
}

export async function logout(): Promise<void> {
  await postJson("/api/logout", {});
}

export async function loadProducts(): Promise<ShopProduct[]> {
  const payload = await getJson("/api/products");
  if (!payload || typeof payload !== "object" || !("products" in payload)) return [];
  return (payload as { products: ShopProduct[] }).products;
}

export async function addProduct(form: FormData): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/products`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, payload);
}

export async function removeProduct(id: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/products/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new HttpError(response.status, payload);
  }
}

export async function saveFields(fields: string[]): Promise<string[]> {
  const response = await fetch(`${apiBaseUrl}/api/extract-fields`, {
    method: "PUT",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ fields }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new HttpError(response.status, payload);
  if (!payload || typeof payload !== "object" || !("fields" in payload)) return fields;
  return (payload as { fields: string[] }).fields;
}

export function accountError(error: unknown): string {
  if (error instanceof HttpError) return errorDetail(error.payload) ?? "Request failed.";
  return "Request failed.";
}
