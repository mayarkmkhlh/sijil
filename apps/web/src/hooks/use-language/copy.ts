import type { Order } from "@sijil/shared";
import type { Channel } from "../../lib/enums/channel.js";
import type { Language } from "../../lib/types/language.type.js";
import type { ConversationStatus } from "../../modules/inbox/libs/types/conversation.type.js";

type PaymentMethod = NonNullable<Order["payment_method"]>;
type ChatLanguage = Order["language"];

export type Copy = {
  store: string;
  demo: string;
  languageLabel: string;
  inbox: string;
  chatCount: (count: number) => string;
  filterLabel: string;
  filters: { all: string; new: string; incomplete: string };
  status: Record<ConversationStatus, string>;
  channels: Record<Channel, string>;
  simulated: string;
  connect: string;
  connectNote: string;
  dialects: Record<ChatLanguage, string>;
  extract: string;
  extracting: string;
  extractNote: string;
  slipTitle: string;
  waiting: string;
  ready: string;
  fields: {
    customer_name: string;
    delivery_city: string;
    delivery_district: string;
    delivery_address: string;
    delivery_date: string;
    payment_method: string;
  };
  currency: string;
  itemsMissing: string;
  itemGap: {
    name: (index: number) => string;
    qty: (index: number) => string;
    unit_price: (index: number) => string;
    variant: (index: number) => string;
    "variant.size": (index: number) => string;
    "variant.colour": (index: number) => string;
    "variant.text": (index: number) => string;
  };
  missing: string;
  columns: { item: string; qty: string; price: string; amount: string };
  total: string;
  totalNote: string;
  structure: string;
  structurePassed: string;
  attempt: (count: number) => string;
  confidence: (value: number) => string;
  approve: string;
  approveBlocked: string;
  sampleKicker: string;
  sampleInvoice: string;
  sampleInvoiceNote: string;
  sampleBillTo: string;
  askTitle: string;
  askNote: string;
  askCopy: string;
  notInCatalog: string;
  catalogPrice: (price: string) => string;
  chatSaid: (price: string) => string;
  retry: string;
  copyJson: string;
  copied: string;
  emptyTitle: string;
  emptyBody: string;
  loading: string;
  notAnOrder: string;
  errorTitle: string;
  errorSchema: string;
  errorModel: string;
  errorTimeout: string;
  cachedReply: string;
  payments: Record<PaymentMethod, string>;
};

const ar: Copy = {
  store: "المتجر: حلويات ريم (تجريبي)",
  demo: "محاكاة · بيانات تجريبية فقط",
  languageLabel: "اللغة",
  inbox: "الوارد",
  chatCount: (count) => `${count} محادثات · محاكاة`,
  filterLabel: "تصفية الوارد",
  filters: { all: "الكل", new: "جديد", incomplete: "بانتظار معلومات" },
  status: { new: "جديد", incomplete: "ناقص", ready: "جاهز للاعتماد", approved: "معتمد" },
  channels: { instagram_dm: "إنستقرام DM", whatsapp: "واتساب" },
  simulated: "محاكاة",
  connect: "ربط واتساب وإنستقرام (قريبًا)",
  connectNote: "المحادثات هنا تجريبية ومكتوبة للعرض. لا يوجد اتصال حقيقي بأي قناة بعد.",
  dialects: {
    gulf_ar: "لهجة خليجية",
    msa: "فصحى",
    en: "إنجليزية",
    mixed: "مختلطة",
  },
  extract: "حوّل المحادثة إلى طلب",
  extracting: "يقرأ المحادثة…",
  extractNote: "النموذج يقرأ المحادثة، والكود يتحقق من النتيجة قبل عرضها.",
  slipTitle: "قسيمة طلب",
  waiting: "بانتظار معلومات",
  ready: "جاهز للاعتماد",
  fields: {
    customer_name: "الاسم",
    delivery_city: "المدينة",
    delivery_district: "الحي",
    delivery_address: "العنوان",
    delivery_date: "التسليم",
    payment_method: "الدفع",
  },
  currency: "العملة",
  itemsMissing: "الأصناف",
  itemGap: {
    name: (index) => `اسم الصنف ${index}`,
    qty: (index) => `كمية الصنف ${index}`,
    unit_price: (index) => `سعر الصنف ${index}`,
    variant: (index) => `تفاصيل الصنف ${index}`,
    "variant.size": (index) => `مقاس الصنف ${index}`,
    "variant.colour": (index) => `لون الصنف ${index}`,
    "variant.text": (index) => `وصف الصنف ${index}`,
  },
  missing: "ناقص",
  columns: { item: "الصنف", qty: "الكمية", price: "السعر", amount: "المبلغ" },
  total: "الإجمالي",
  totalNote: "يُحسب في الكود، لا من النموذج",
  structure: "تحقق البنية",
  structurePassed: "نجح",
  attempt: (count) => `محاولة ${count}`,
  confidence: (value) => `ثقة ${value.toFixed(2)}`,
  approve: "اعتماد الطلب",
  approveBlocked: "صنف غير موجود في الكتالوج",
  sampleKicker: "عينة",
  sampleInvoice: "معاينة فاتورة",
  sampleInvoiceNote: "لم تُصدر ولم تُرسل، ولم يُدفع شيء.",
  sampleBillTo: "إلى",
  askTitle: "رد للنسخ",
  askNote: "لا يُرسل شيء. انسخه وأرسله بنفسك.",
  askCopy: "نسخ الرد",
  notInCatalog: "ليس في الكتالوج",
  catalogPrice: (price) => `الكتالوج ${price}`,
  chatSaid: (price) => `المحادثة قالت ${price}`,
  retry: "إعادة",
  copyJson: "نسخ JSON",
  copied: "تم النسخ",
  emptyTitle: "لم يُستخرج طلب بعد",
  emptyBody: "اضغط «حوّل المحادثة إلى طلب» في المحادثة.",
  loading: "يقرأ المحادثة…",
  notAnOrder: "ليست طلبًا جديدًا",
  errorTitle: "تعذّر الاستخراج",
  errorSchema: "الرد ما طابق شكل الطلب.",
  errorModel: "تعذّر الاتصال بالنموذج.",
  errorTimeout: "استغرق النموذج وقتًا طويلاً.",
  cachedReply: "رد محفوظ للعرض. ليس من هذه المحاولة.",
  payments: {
    cash_on_delivery: "الدفع عند الاستلام",
    bank_transfer: "تحويل بنكي",
    paypal: "PayPal",
    mada: "مدى",
    apple_pay: "Apple Pay",
    stc_pay: "STC Pay",
    card: "بطاقة",
    card_link: "رابط بطاقة",
  },
};

const en: Copy = {
  store: "Store: Reem Sweets (demo)",
  demo: "Simulated demo, synthetic data",
  languageLabel: "Language",
  inbox: "Inbox",
  chatCount: (count) => `${count} chats · simulated`,
  filterLabel: "Filter inbox",
  filters: { all: "All", new: "New", incomplete: "Waiting on details" },
  status: { new: "New", incomplete: "Incomplete", ready: "Ready to approve", approved: "Approved" },
  channels: { instagram_dm: "Instagram DM", whatsapp: "WhatsApp" },
  simulated: "simulated",
  connect: "Connect WhatsApp and Instagram (coming soon)",
  connectNote: "These chats are fictional and written for the demo. No channel is connected yet.",
  dialects: {
    gulf_ar: "Gulf Arabic",
    msa: "Modern Standard Arabic",
    en: "English",
    mixed: "Mixed",
  },
  extract: "Turn this chat into an order",
  extracting: "Reading the chat…",
  extractNote: "The model reads the chat. Code checks the result before it is shown.",
  slipTitle: "Order slip",
  waiting: "Waiting on details",
  ready: "Ready to approve",
  fields: {
    customer_name: "Name",
    delivery_city: "City",
    delivery_district: "District",
    delivery_address: "Address",
    delivery_date: "Delivery",
    payment_method: "Payment",
  },
  currency: "Currency",
  itemsMissing: "Items",
  itemGap: {
    name: (index) => `Item ${index} name`,
    qty: (index) => `Item ${index} quantity`,
    unit_price: (index) => `Item ${index} price`,
    variant: (index) => `Item ${index} details`,
    "variant.size": (index) => `Item ${index} size`,
    "variant.colour": (index) => `Item ${index} colour`,
    "variant.text": (index) => `Item ${index} note`,
  },
  missing: "Missing",
  columns: { item: "Item", qty: "Qty", price: "Price", amount: "Amount" },
  total: "Total",
  totalNote: "Calculated in code, not by the model",
  structure: "Structure check",
  structurePassed: "passed",
  attempt: (count) => `attempt ${count}`,
  confidence: (value) => `confidence ${value.toFixed(2)}`,
  approve: "Approve order",
  approveBlocked: "An item is not in the catalog",
  sampleKicker: "SAMPLE",
  sampleInvoice: "Invoice preview",
  sampleInvoiceNote: "Nothing was issued, sent, or paid.",
  sampleBillTo: "To",
  askTitle: "Reply to copy",
  askNote: "Nothing is sent. You copy this and send it yourself.",
  askCopy: "Copy reply",
  notInCatalog: "Not in the catalog",
  catalogPrice: (price) => `Catalog ${price}`,
  chatSaid: (price) => `Chat said ${price}`,
  retry: "Retry",
  copyJson: "Copy JSON",
  copied: "Copied",
  emptyTitle: "No order extracted yet",
  emptyBody: "Use “Turn this chat into an order” in the chat.",
  loading: "Reading the chat…",
  notAnOrder: "Not a new order",
  errorTitle: "Couldn't extract an order",
  errorSchema: "The reply didn't match the order schema.",
  errorModel: "The model call failed.",
  errorTimeout: "The model took too long.",
  cachedReply: "Cached demo reply. Not from this call.",
  payments: {
    cash_on_delivery: "Cash on delivery",
    bank_transfer: "Bank transfer",
    paypal: "PayPal",
    mada: "Mada",
    apple_pay: "Apple Pay",
    stc_pay: "STC Pay",
    card: "Card",
    card_link: "Card link",
  },
};

export const copy: Record<Language, Copy> = { ar, en };
