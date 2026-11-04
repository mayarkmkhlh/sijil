import { useEffect, useState, type FormEvent } from "react";
import { extractFieldKeys, type ExtractFieldKey } from "@sijil/shared";
import { Button } from "../../components/button/button.js";
import { Heading } from "../../components/heading/heading.js";
import { Input } from "../../components/input/input.js";
import type { Copy } from "../../hooks/use-language/copy.js";
import { apiBaseUrl } from "../../lib/config/config.js";
import { formatMoney } from "../../lib/helpers/format-money.js";
import {
  accountError,
  addProduct,
  loadProducts,
  removeProduct,
  saveFields,
  updateProduct,
  type ShopProduct,
} from "./account-api.js";

export function ShopScreen({
  fields,
  shopLink,
  copy,
  onFields,
}: {
  fields: readonly string[];
  shopLink: string;
  copy: Copy;
  onFields: (fields: string[]) => void;
}) {
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [aliases, setAliases] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [chosen, setChosen] = useState<string[]>([...fields]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadProducts()
      .then(setProducts)
      .catch((caught: unknown) => setError(accountError(caught)));
  }, []);

  useEffect(() => {
    setChosen([...fields]);
  }, [fields]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setPrice("");
    setAliases("");
    setImage(null);
  }

  function edit(product: ShopProduct) {
    setError(null);
    setEditingId(product.id);
    setName(product.name);
    setPrice(String(product.price));
    setAliases(product.aliases.join(", "));
    setImage(null);
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData();
    form.set("name", name);
    form.set("price", price);
    form.set("aliases", aliases);
    if (image) form.set("image", image);
    try {
      if (editingId) await updateProduct(editingId, form);
      else await addProduct(form);
      setProducts(await loadProducts());
      resetForm();
    } catch (caught) {
      setError(accountError(caught));
    } finally {
      setBusy(false);
    }
  }

  async function destroy(id: string) {
    setError(null);
    try {
      await removeProduct(id);
      setProducts((current) => current.filter((product) => product.id !== id));
    } catch (caught) {
      setError(accountError(caught));
    }
  }

  function toggle(key: ExtractFieldKey) {
    setSaved(false);
    setChosen((current) => (current.includes(key) ? current.filter((field) => field !== key) : [...current, key]));
  }

  async function saveChosen() {
    setError(null);
    try {
      const next = await saveFields(chosen);
      onFields(next);
      setSaved(true);
    } catch (caught) {
      setError(accountError(caught));
    }
  }

  return (
    <div className="shop">
      <section className="column shop-column">
        <Heading level={2}>{copy.customerLink}</Heading>
        <p className="shop-note">{copy.customerLinkHint}</p>
        <p className="shop-link-url" dir="ltr">
          {shopLink}
        </p>
        <Button
          variant="ghost"
          onClick={() => {
            void navigator.clipboard.writeText(shopLink).then(() => setLinkCopied(true));
          }}
        >
          {linkCopied ? copy.copied : copy.customerCopyLink}
        </Button>
      </section>
      <section className="column shop-column">
        <Heading level={2}>{copy.shopProducts}</Heading>
        {products.length === 0 ? <p className="shop-note">{copy.shopEmpty}</p> : null}
        <ul className="product-list">
          {products.map((product) => (
            <li key={product.id} className={product.id === editingId ? "product-row is-editing" : "product-row"}>
              {product.hasImage ? <ProductPhoto id={product.id} /> : <span className="product-photo" />}
              <span>
                <strong>{product.name}</strong>
                <span className="product-meta">
                  {formatMoney(product.price, "SAR")}
                  {product.aliases.length > 0 ? ` · ${product.aliases.join(", ")}` : ""}
                </span>
              </span>
              <span className="product-actions">
                <Button variant="ghost" onClick={() => edit(product)}>
                  {copy.shopEdit}
                </Button>
                <Button variant="quiet" onClick={() => void destroy(product.id)}>
                  {copy.shopDelete}
                </Button>
              </span>
            </li>
          ))}
        </ul>
        <form className="product-form" onSubmit={(event) => void saveProduct(event)}>
          {error ? <p className="auth-error">{error}</p> : null}
          <Input label={copy.shopProductName} value={name} onChange={(event) => setName(event.target.value)} required />
          <Input
            label={copy.shopPrice}
            inputMode="decimal"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
          <Input label={copy.shopAliases} value={aliases} onChange={(event) => setAliases(event.target.value)} />
          <label className="field">
            <span>{copy.shopImage}</span>
            <input
              key={editingId ?? "new"}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
          </label>
          {editingId ? <p className="shop-note">{copy.shopImageKeep}</p> : null}
          <span className="product-actions">
            <Button disabled={busy} type="submit">
              {editingId ? copy.shopSaveProduct : copy.shopAdd}
            </Button>
            {editingId ? (
              <Button variant="ghost" type="button" onClick={resetForm}>
                {copy.shopCancel}
              </Button>
            ) : null}
          </span>
        </form>
      </section>
      <section className="column shop-column">
        <Heading level={2}>{copy.shopFields}</Heading>
        <p className="shop-note">{copy.shopFieldsNote}</p>
        <ul className="field-picks">
          {extractFieldKeys.map((key) => (
            <li key={key}>
              <label>
                <input type="checkbox" checked={chosen.includes(key)} onChange={() => toggle(key)} />
                {copy.extractFields[key]}
              </label>
            </li>
          ))}
        </ul>
        <Button onClick={() => void saveChosen()}>{saved ? copy.shopSaved : copy.shopSaveFields}</Button>
      </section>
    </div>
  );
}

function ProductPhoto({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let url = "";
    let cancel = false;
    void fetch(`${apiBaseUrl}/api/products/${id}/image`, { credentials: "include" }).then(async (response) => {
      if (!response.ok || cancel) return;
      url = URL.createObjectURL(await response.blob());
      if (!cancel) setSrc(url);
    });
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);

  if (!src) return <span className="product-photo" />;
  return <img className="product-photo" src={src} alt="" />;
}
