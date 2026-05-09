import path from "node:path";
import fs from "node:fs";
import Database from "better-sqlite3";

const DATA_DIR = path.resolve(process.cwd(), "server", "data");
const DB_PATH = path.join(DATA_DIR, "app.db");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function nowIso() {
  return new Date().toISOString();
}

function svgPlaceholder({ title, a = "#6a7dff", b = "#2ee6a6" }) {
  const safeTitle = String(title || "Product").slice(0, 34);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${a}" stop-opacity="0.9"/>
          <stop offset="1" stop-color="${b}" stop-opacity="0.85"/>
        </linearGradient>
        <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="20"/>
        </filter>
      </defs>
      <rect width="960" height="600" fill="#0b1220"/>
      <circle cx="220" cy="140" r="140" fill="url(#g)" filter="url(#blur)" opacity="0.9"/>
      <circle cx="760" cy="180" r="170" fill="url(#g)" filter="url(#blur)" opacity="0.55"/>
      <circle cx="530" cy="520" r="190" fill="url(#g)" filter="url(#blur)" opacity="0.35"/>
      <rect x="60" y="60" width="840" height="480" rx="36" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)"/>
      <text x="110" y="330" fill="rgba(255,255,255,0.86)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-weight="800" font-size="44">
        ${safeTitle}
      </text>
      <text x="110" y="380" fill="rgba(255,255,255,0.62)" font-family="ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" font-weight="650" font-size="22">
        Image placeholder
      </text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function openDb() {
  ensureDir(DATA_DIR);
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function migrate(db) {
  db.exec(`
    create table if not exists products (
      id text primary key,
      name text not null,
      description text not null default '',
      price_cents integer not null,
      compare_at_cents integer,
      image_url text,
      category text,
      tags text,
      is_active integer not null default 1,
      stock_qty integer not null default 0,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists collections (
      id integer primary key autoincrement,
      key text not null,
      product_id text not null references products(id) on delete cascade,
      sort_order integer not null default 0,
      ends_at text,
      unique(key, product_id)
    );

    create table if not exists carts (
      id text primary key,
      created_at text not null
    );

    create table if not exists cart_items (
      id integer primary key autoincrement,
      cart_id text not null references carts(id) on delete cascade,
      product_id text not null references products(id),
      qty integer not null,
      unique(cart_id, product_id)
    );

    create table if not exists orders (
      id text primary key,
      order_number text not null unique,
      status text not null,
      subtotal_cents integer not null,
      delivery_fee_cents integer not null,
      total_cents integer not null,
      customer_name text not null,
      phone text not null,
      address_line text not null,
      district text not null,
      notes text,
      payment_method text not null,
      payment_status text not null,
      created_at text not null,
      updated_at text not null
    );

    create table if not exists order_items (
      id integer primary key autoincrement,
      order_id text not null references orders(id) on delete cascade,
      product_id text not null,
      name_snapshot text not null,
      price_cents_snapshot integer not null,
      qty integer not null
    );

    create table if not exists shipments (
      order_id text primary key references orders(id) on delete cascade,
      shipping_status text not null,
      eta text,
      updated_at text not null
    );
  `);
}

export function seed(db) {
  const existing = db.prepare("select count(*) as c from products").get();
  if (existing.c > 0) return;

  const insertProduct = db.prepare(`
    insert into products (
      id, name, description, price_cents, compare_at_cents, image_url, category, tags, is_active, stock_qty, created_at, updated_at
    ) values (
      @id, @name, @description, @price_cents, @compare_at_cents, @image_url, @category, @tags, @is_active, @stock_qty, @created_at, @updated_at
    )
  `);

  const products = [
    {
      id: "p_earbuds",
      name: "Noise-cancel earbuds",
      description: "Compact ANC earbuds with crisp sound and comfortable fit.",
      price_cents: 5999,
      compare_at_cents: 9999,
      image_url: svgPlaceholder({ title: "Noise-cancel earbuds" }),
      category: "Electronics",
      tags: "audio,earbuds,anc",
      is_active: 1,
      stock_qty: 24,
    },
    {
      id: "p_smarthome",
      name: "Smart home starter kit",
      description: "A starter bundle for smart lighting and a hub.",
      price_cents: 12900,
      compare_at_cents: 17900,
      image_url: svgPlaceholder({ title: "Smart home starter kit", a: "#2ee6a6", b: "#6a7dff" }),
      category: "Home",
      tags: "smart,home,kit",
      is_active: 1,
      stock_qty: 12,
    },
    {
      id: "p_chair",
      name: "Ergonomic desk chair",
      description: "Breathable mesh with adjustable support for long sessions.",
      price_cents: 18999,
      compare_at_cents: 24999,
      image_url: svgPlaceholder({ title: "Ergonomic desk chair", a: "#ffbf4a", b: "#6a7dff" }),
      category: "Home",
      tags: "office,chair,ergonomic",
      is_active: 1,
      stock_qty: 9,
    },
    {
      id: "p_skincare",
      name: "Premium skincare set",
      description: "Daily essentials set—gift-ready packaging.",
      price_cents: 3450,
      compare_at_cents: 4900,
      image_url: svgPlaceholder({ title: "Premium skincare set" }),
      category: "Beauty",
      tags: "beauty,skincare,set",
      is_active: 1,
      stock_qty: 30,
    },
    {
      id: "p_keyboard",
      name: "Wireless keyboard",
      description: "Quiet keys, solid battery life, and clean minimal design.",
      price_cents: 3999,
      compare_at_cents: 6999,
      image_url: svgPlaceholder({ title: "Wireless keyboard", a: "#ffbf4a", b: "#6a7dff" }),
      category: "Electronics",
      tags: "keyboard,wireless,accessories",
      is_active: 1,
      stock_qty: 18,
    },
    {
      id: "p_airfryer",
      name: "Air fryer 5L",
      description: "Fast, crispy results with easy cleanup.",
      price_cents: 7400,
      compare_at_cents: 11900,
      image_url: svgPlaceholder({ title: "Air fryer 5L", a: "#ffbf4a", b: "#2ee6a6" }),
      category: "Home",
      tags: "kitchen,airfryer",
      is_active: 1,
      stock_qty: 10,
    },
    {
      id: "p_shoes",
      name: "Running shoes",
      description: "Breathable, lightweight trainers for daily runs.",
      price_cents: 6450,
      compare_at_cents: 8900,
      image_url: svgPlaceholder({ title: "Running shoes", a: "#6a7dff", b: "#ffbf4a" }),
      category: "Sports",
      tags: "sports,shoes,running",
      is_active: 1,
      stock_qty: 15,
    },
    {
      id: "p_ssd",
      name: "Portable SSD 1TB",
      description: "Fast, compact storage—great for backups and travel.",
      price_cents: 7999,
      compare_at_cents: 10999,
      image_url: svgPlaceholder({ title: "Portable SSD 1TB", a: "#2ee6a6", b: "#6a7dff" }),
      category: "Electronics",
      tags: "storage,ssd,usb-c",
      is_active: 1,
      stock_qty: 14,
    },
    {
      id: "p_essentials",
      name: "Everyday essentials pack",
      description: "A handy essentials pack for home restocks.",
      price_cents: 2299,
      compare_at_cents: 2999,
      image_url: svgPlaceholder({ title: "Everyday essentials pack", a: "#2ee6a6", b: "#6a7dff" }),
      category: "Home",
      tags: "essentials,home",
      is_active: 1,
      stock_qty: 50,
    },
    {
      id: "p_charger",
      name: "Phone charger 65W",
      description: "Dual-port fast charger—compact and travel-friendly.",
      price_cents: 1850,
      compare_at_cents: 2600,
      image_url: svgPlaceholder({ title: "Phone charger 65W", a: "#6a7dff", b: "#2ee6a6" }),
      category: "Electronics",
      tags: "charger,usb-c,fast",
      is_active: 1,
      stock_qty: 40,
    },
    {
      id: "p_hoodie",
      name: "Comfort hoodie",
      description: "Soft-touch hoodie with a clean, modern fit.",
      price_cents: 3500,
      compare_at_cents: 4500,
      image_url: svgPlaceholder({ title: "Comfort hoodie", a: "#6a7dff", b: "#ffbf4a" }),
      category: "Fashion",
      tags: "fashion,hoodie",
      is_active: 1,
      stock_qty: 28,
    },
    {
      id: "p_grinder",
      name: "Coffee grinder",
      description: "Consistent grind sizes with a quieter motor.",
      price_cents: 4900,
      compare_at_cents: 6900,
      image_url: svgPlaceholder({ title: "Coffee grinder", a: "#2ee6a6", b: "#ffbf4a" }),
      category: "Home",
      tags: "coffee,kitchen",
      is_active: 1,
      stock_qty: 11,
    },
    {
      id: "p_backpack",
      name: "Travel backpack 35L",
      description: "Carry-on friendly with smart organization.",
      price_cents: 5499,
      compare_at_cents: 7999,
      image_url: svgPlaceholder({ title: "Travel backpack 35L", a: "#6a7dff", b: "#2ee6a6" }),
      category: "Fashion",
      tags: "travel,bag,backpack",
      is_active: 1,
      stock_qty: 17,
    },
    {
      id: "p_dinnerware",
      name: "Ceramic dinnerware set",
      description: "Modern ceramic set with secure packaging.",
      price_cents: 6800,
      compare_at_cents: 8900,
      image_url: svgPlaceholder({ title: "Ceramic dinnerware set", a: "#2ee6a6", b: "#6a7dff" }),
      category: "Home",
      tags: "home,ceramic,dinnerware",
      is_active: 1,
      stock_qty: 8,
    },
    {
      id: "p_watch",
      name: "Analog watch",
      description: "Classic analog watch with two strap options.",
      price_cents: 10900,
      compare_at_cents: 14900,
      image_url: svgPlaceholder({ title: "Analog watch", a: "#ffbf4a", b: "#6a7dff" }),
      category: "Fashion",
      tags: "watch,style",
      is_active: 1,
      stock_qty: 13,
    },
    {
      id: "p_headset",
      name: "Language learning headset",
      description: "Comfortable headset with noise reduction for focus.",
      price_cents: 4200,
      compare_at_cents: 5900,
      image_url: svgPlaceholder({ title: "Language learning headset", a: "#6a7dff", b: "#2ee6a6" }),
      category: "Electronics",
      tags: "audio,headset",
      is_active: 1,
      stock_qty: 16,
    }
  ];

  const ts = nowIso();
  const tx = db.transaction(() => {
    for (const p of products) {
      insertProduct.run({ ...p, created_at: ts, updated_at: ts });
    }

    const insertCollection = db.prepare(
      "insert into collections (key, product_id, sort_order, ends_at) values (@key, @product_id, @sort_order, @ends_at)",
    );

    const endsSoon = (hours) => new Date(Date.now() + hours * 3600 * 1000).toISOString();

    const collections = [
      // Today’s Deals
      { key: "deals", product_id: "p_earbuds", sort_order: 10, ends_at: null },
      { key: "deals", product_id: "p_smarthome", sort_order: 20, ends_at: null },
      { key: "deals", product_id: "p_chair", sort_order: 30, ends_at: null },
      { key: "deals", product_id: "p_skincare", sort_order: 40, ends_at: null },

      // Don’t Miss (limited)
      { key: "limited", product_id: "p_keyboard", sort_order: 10, ends_at: endsSoon(6.2) },
      { key: "limited", product_id: "p_airfryer", sort_order: 20, ends_at: endsSoon(3.3) },
      { key: "limited", product_id: "p_shoes", sort_order: 30, ends_at: endsSoon(1.8) },
      { key: "limited", product_id: "p_ssd", sort_order: 40, ends_at: endsSoon(4.6) },

      // Fast Delivery
      { key: "fast", product_id: "p_essentials", sort_order: 10, ends_at: null },
      { key: "fast", product_id: "p_charger", sort_order: 20, ends_at: null },
      { key: "fast", product_id: "p_hoodie", sort_order: 30, ends_at: null },
      { key: "fast", product_id: "p_grinder", sort_order: 40, ends_at: null },

      // International Shipping
      { key: "intl", product_id: "p_backpack", sort_order: 10, ends_at: null },
      { key: "intl", product_id: "p_dinnerware", sort_order: 20, ends_at: null },
      { key: "intl", product_id: "p_watch", sort_order: 30, ends_at: null },
      { key: "intl", product_id: "p_headset", sort_order: 40, ends_at: null },
    ];

    for (const c of collections) insertCollection.run(c);
  });

  tx();
}

