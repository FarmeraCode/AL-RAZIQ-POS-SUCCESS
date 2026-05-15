import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Category = { id: string; name: string; icon: string };
export type MenuItem = {
  id: string;
  name: string;
  categoryId: string;
  inventoryCategory?: string;
  price: number;
  cost?: number;
  image?: string;
  description?: string;
  available: boolean;
  prepTime?: number;
  modifiers?: { name: string; price: number }[];
  taxable?: boolean;
  sku?: string;
  barcode?: string;
};
export type OrderItem = {
  id: string;
  itemId: string;
  name: string;
  price: number;
  qty: number;
  notes?: string;
  modifiers?: { name: string; price: number }[];
};
export type OrderStatus = "open" | "sent" | "preparing" | "ready" | "served" | "paid" | "cancelled" | "refunded";
export type OrderType = "dine-in" | "takeaway" | "delivery";
export type PaymentMethod = "cash" | "card" | "wallet" | "split" | "credit";
export type Order = {
  id: string;
  number: number;
  type: OrderType;
  tableId?: string;
  customerId?: string;
  items: OrderItem[];
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  subtotal: number;
  discount: number;
  tax: number;
  service?: number;
  total: number;
  paidCash?: number;
  paidCard?: number;
  paidWallet?: number;
  change?: number;
  paymentMethod?: PaymentMethod;
  fbrInvoiceNumber?: string;
  fbrQrPayload?: string;
  notes?: string;
  staffId?: string;
  shiftId?: string;
  branchId?: string;
  pointsEarned?: number;
};
export type Table = {
  id: string;
  name: string;
  seats: number;
  zone: string;
  status: "available" | "occupied" | "reserved" | "cleaning";
  orderId?: string;
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  points: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  totalSpent: number;
  visits: number;
  joinedAt: number;
};
export type Promotion = {
  id: string;
  name: string;
  code?: string;
  type: "percent" | "flat" | "bogo";
  value: number;
  active: boolean;
  startsAt?: number;
  endsAt?: number;
  minOrder?: number;
};
export type Tenant = {
  id: string;
  name: string;
  ownerEmail: string;
  plan: "starter" | "growth" | "enterprise";
  license: "monthly" | "yearly" | "lifetime" | "trial";
  expiresAt?: number;
  active: boolean;
  modules: Record<string, boolean>;
  createdAt: number;
  branches?: number;
};
export type StaffRole = "owner" | "cashier" | "waiter" | "kitchen" | "manager";
export type Staff = {
  id: string;
  name: string;
  pin: string;
  role: StaffRole;
  phone?: string;
  active: boolean;
  /** Modules this staff can access. Ignored when role === "owner" (owner sees all). */
  permissions?: string[];
};

/** Returns true if this staff member can access the given module key. */
export function staffCanAccess(s: Staff | undefined, mod: string | null | undefined): boolean {
  if (!s) return false;
  if (!mod) return true; // unguarded sections (Dashboard, Settings home)
  if (s.role === "owner") return true;
  return (s.permissions ?? []).includes(mod);
}

// ---------------------------------------------------------------------------
// LAN sync snapshot helpers (serializable state only)
// ---------------------------------------------------------------------------
export type LanSnapshot = {
  categories: Category[];
  items: MenuItem[];
  tables: Table[];
  customers: Customer[];
  promotions: Promotion[];
  orders: Order[];
  salesReturns: SalesReturn[];
  tenants: Tenant[];
  staff: Staff[];
  branches: Branch[];
  shifts: Shift[];
  expenses: Expense[];
  expenseCategories: string[];
  stock: StockItem[];
  stockMoves: StockMove[];
  inventoryItems: InventoryItem[];
  inventoryMoves: InventoryMove[];
  inventoryCategories: string[];
  orderCounter: number;
  returnCounter: number;
  expenseCounter: number;
  currentBranchId: string;
  settings: Settings;
};

const LAN_KEYS: (keyof LanSnapshot)[] = [
  "categories",
  "items",
  "tables",
  "customers",
  "promotions",
  "orders",
  "salesReturns",
  "tenants",
  "staff",
  "branches",
  "shifts",
  "expenses",
  "expenseCategories",
  "stock",
  "stockMoves",
  "inventoryItems",
  "inventoryMoves",
  "inventoryCategories",
  "orderCounter",
  "returnCounter",
  "expenseCounter",
  "currentBranchId",
  "settings",
];

export function getLanSnapshot(): LanSnapshot {
  const s = usePos.getState();
  const snap = {} as LanSnapshot;
  for (const k of LAN_KEYS) (snap as any)[k] = (s as any)[k];
  return snap;
}

export function applyLanSnapshot(next: LanSnapshot) {
  usePos.setState((s) => {
    const patch: Partial<State> = {};
    const incomingItems = (next as any).items as MenuItem[] | undefined;
    const incomingCats = (next as any).categories as Category[] | undefined;
    const incomingStock = (next as any).stock as StockItem[] | undefined;
    // Never let LAN "last write" wipe real data on this device.
    const skipItems =
      Array.isArray(incomingItems) && incomingItems.length === 0 && s.items.length > 0;
    const skipCats =
      Array.isArray(incomingCats) && incomingCats.length === 0 && s.categories.length > 0;
    const skipStock =
      Array.isArray(incomingStock) && incomingStock.length === 0 && s.stock.length > 0;

    for (const k of LAN_KEYS) {
      const v = (next as any)[k];
      // Older LAN snapshots / partial JSON must not wipe newer fields (e.g. inventoryCategories).
      if (v === undefined) continue;
      if (k === "items" && skipItems) continue;
      if (k === "categories" && skipCats) continue;
      if (k === "stock" && skipStock) continue;
      if (k === "inventoryItems" && v === undefined) continue;
      if (k === "inventoryMoves" && v === undefined) continue;
      (patch as any)[k] = v;
    }
    return { ...s, ...patch };
  });
}
export type Branch = {
  id: string;
  name: string;
  address: string;
  phone?: string;
  active: boolean;
};
export type Shift = {
  id: string;
  staffId: string;
  branchId?: string;
  openedAt: number;
  closedAt?: number;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  notes?: string;
};
export type Expense = {
  id: string;
  number: number;
  category: string;
  amount: number;
  note?: string;
  shiftId?: string;
  createdAt: number;
};
export type SalesReturn = {
  id: string;
  number: number;          // unique sequential return #
  orderId: string;         // original sale
  orderNumber: number;
  items: OrderItem[];      // returned items (subset of original)
  reason?: string;
  refundAmount: number;
  refundMethod: PaymentMethod;
  staffId?: string;
  shiftId?: string;
  createdAt: number;
};
export type StockItem = {
  itemId: string;
  stock: number;
  reorder: number;
  unit: string;
};
export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  sku?: string;
  unit: string;
  stock: number;
  reorder: number;
  cost: number;
  createdAt: number;
  updatedAt: number;
};
export type InventoryMove = {
  id: string;
  inventoryItemId: string;
  type: "in" | "out" | "adjust" | "waste";
  qty: number;
  note?: string;
  createdAt: number;
};
export type StockMove = {
  id: string;
  itemId: string;
  type: "in" | "out" | "adjust" | "waste";
  qty: number;
  note?: string;
  createdAt: number;
};
export type Settings = {
  restaurantName: string;
  ntn?: string;
  strn?: string;
  address?: string;
  phone?: string;
  currency: string;
  taxRate: number;
  serviceCharge: number;
  pointsPer100: number;
  receiptFooter: string;
  receiptHeaderUrdu?: string;
  fbr: { enabled: boolean; posId: string; apiKey: string; endpoint: string; mode: "sandbox" | "live" };
  modules: Record<string, boolean>;
  paymentMethods: { cash: boolean; card: boolean; jazzcash: boolean; easypaisa: boolean; sadapay: boolean; nayapay: boolean };
  printer: { width: 58 | 80; copies: number; autoOpenDrawer: boolean };
  theme: "light" | "dark";
  /** When true, POS blocks adding items with zero stock. Default false (allow oversell). */
  blockPOSWhenOutOfStock?: boolean;
};

const cats: Category[] = [
  { id: "c1", name: "Starters", icon: "🥗" },
  { id: "c2", name: "Mains", icon: "🍽️" },
  { id: "c3", name: "Pizza", icon: "🍕" },
  { id: "c4", name: "Burgers", icon: "🍔" },
  { id: "c5", name: "BBQ & Karahi", icon: "🍢" },
  { id: "c6", name: "Beverages", icon: "🥤" },
  { id: "c7", name: "Desserts", icon: "🍰" },
];

const items: MenuItem[] = [
  { id: "i1", name: "Caesar Salad", categoryId: "c1", price: 850, cost: 300, available: true, prepTime: 8, taxable: true, sku: "ST-001" },
  { id: "i2", name: "Chicken Wings", categoryId: "c1", price: 950, cost: 400, available: true, prepTime: 12, taxable: true, sku: "ST-002" },
  { id: "i3", name: "Grilled Steak", categoryId: "c2", price: 2400, cost: 1100, available: true, prepTime: 20, taxable: true, sku: "MN-001" },
  { id: "i4", name: "Butter Chicken", categoryId: "c2", price: 1450, cost: 550, available: true, prepTime: 15, taxable: true, sku: "MN-002" },
  { id: "i5", name: "Margherita Pizza", categoryId: "c3", price: 1200, cost: 450, available: true, prepTime: 14, taxable: true, sku: "PZ-001" },
  { id: "i6", name: "Pepperoni Pizza", categoryId: "c3", price: 1450, cost: 550, available: true, prepTime: 14, taxable: true, sku: "PZ-002" },
  { id: "i7", name: "Classic Burger", categoryId: "c4", price: 950, cost: 380, available: true, prepTime: 10, taxable: true, sku: "BR-001" },
  { id: "i8", name: "Cheese Burger", categoryId: "c4", price: 1100, cost: 420, available: true, prepTime: 10, taxable: true, sku: "BR-002" },
  { id: "i14", name: "Chicken Karahi", categoryId: "c5", price: 1850, cost: 700, available: true, prepTime: 22, taxable: true, sku: "BQ-001" },
  { id: "i15", name: "Seekh Kebab (4 pcs)", categoryId: "c5", price: 750, cost: 280, available: true, prepTime: 12, taxable: true, sku: "BQ-002" },
  { id: "i9", name: "Cappuccino", categoryId: "c6", price: 450, cost: 120, available: true, prepTime: 4, taxable: true, sku: "BV-001" },
  { id: "i10", name: "Fresh Lime", categoryId: "c6", price: 280, cost: 80, available: true, prepTime: 3, taxable: true, sku: "BV-002" },
  { id: "i11", name: "Cola", categoryId: "c6", price: 200, cost: 70, available: true, prepTime: 1, taxable: true, sku: "BV-003" },
  { id: "i12", name: "Chocolate Lava", categoryId: "c7", price: 650, cost: 220, available: true, prepTime: 8, taxable: true, sku: "DS-001" },
  { id: "i13", name: "Cheesecake", categoryId: "c7", price: 600, cost: 200, available: true, prepTime: 5, taxable: true, sku: "DS-002" },
];

const tables: Table[] = [
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `t${i + 1}`, name: `T${i + 1}`, seats: i % 3 === 0 ? 6 : 4,
    zone: i < 4 ? "Indoor" : "Patio", status: "available" as const,
  })),
  { id: "t9", name: "VIP-1", seats: 8, zone: "VIP", status: "available" },
  { id: "t10", name: "VIP-2", seats: 8, zone: "VIP", status: "available" },
];

const customers: Customer[] = [
  { id: "u1", name: "Ahmed Khan", phone: "0300-1234567", points: 420, tier: "gold", totalSpent: 42000, visits: 18, joinedAt: Date.now() - 86400000 * 120 },
  { id: "u2", name: "Sara Ali", phone: "0321-9876543", points: 1250, tier: "platinum", totalSpent: 125000, visits: 47, joinedAt: Date.now() - 86400000 * 300 },
  { id: "u3", name: "Bilal Hassan", phone: "0345-5551234", points: 80, tier: "bronze", totalSpent: 8000, visits: 4, joinedAt: Date.now() - 86400000 * 30 },
];

const promotions: Promotion[] = [
  { id: "p1", name: "Happy Hour 20%", code: "HAPPY20", type: "percent", value: 20, active: true },
  { id: "p2", name: "Flat 200 off", code: "SAVE200", type: "flat", value: 200, active: true, minOrder: 1000 },
  { id: "p3", name: "Buy 1 Get 1 Pizza", code: "BOGO", type: "bogo", value: 50, active: false },
  { id: "p4", name: "Eid Special 15%", code: "EID15", type: "percent", value: 15, active: true },
];

const ALL_MODULES = {
  pos: true, kds: true, tables: true, menu: true, inventory: true,
  customers: true, promotions: true, reports: true, fbr: true,
  multiBranch: false, staff: true, shifts: true, expenses: true,
  orders: true,
};

const tenants: Tenant[] = [
  { id: "tn1", name: "Demo Restaurant", ownerEmail: "owner@demo.pk", plan: "growth", license: "yearly",
    expiresAt: Date.now() + 86400000 * 200, active: true, modules: { ...ALL_MODULES }, createdAt: Date.now() - 86400000 * 60, branches: 1 },
  { id: "tn2", name: "Karachi Cafe Co.", ownerEmail: "admin@kcc.pk", plan: "starter", license: "monthly",
    expiresAt: Date.now() + 86400000 * 12, active: true, modules: { ...ALL_MODULES, kds: false, fbr: false, multiBranch: false }, createdAt: Date.now() - 86400000 * 20, branches: 1 },
  { id: "tn3", name: "Lahore Grill House", ownerEmail: "ceo@lgh.pk", plan: "enterprise", license: "lifetime",
    active: true, modules: { ...ALL_MODULES, multiBranch: true }, createdAt: Date.now() - 86400000 * 400, branches: 4 },
];

const staff: Staff[] = [
  { id: "s1", name: "Owner Admin", pin: "1234", role: "owner", active: true, phone: "0300-0000001" },
  { id: "s2", name: "Imran (Cashier)", pin: "1111", role: "cashier", active: true, phone: "0300-0000002",
    permissions: ["pos", "orders", "tables", "customers", "shifts"] },
  { id: "s3", name: "Faisal (Waiter)", pin: "2222", role: "waiter", active: true,
    permissions: ["pos", "tables", "orders"] },
  { id: "s4", name: "Ustaad (Kitchen)", pin: "3333", role: "kitchen", active: true,
    permissions: ["kds", "orders"] },
];

const branches: Branch[] = [
  { id: "b1", name: "Main Branch", address: "Gulberg III, Lahore", phone: "042-1234567", active: true },
];

const stock: StockItem[] = items.map((i) => ({
  itemId: i.id, stock: 50 + Math.floor(Math.random() * 40), reorder: 10, unit: "pcs",
}));

type State = {
  categories: Category[];
  items: MenuItem[];
  tables: Table[];
  customers: Customer[];
  promotions: Promotion[];
  orders: Order[];
  salesReturns: SalesReturn[];
  tenants: Tenant[];
  staff: Staff[];
  branches: Branch[];
  shifts: Shift[];
  expenses: Expense[];
  expenseCategories: string[];
  stock: StockItem[];
  stockMoves: StockMove[];
  inventoryItems: InventoryItem[];
  inventoryMoves: InventoryMove[];
  inventoryCategories: string[];
  settings: Settings;
  orderCounter: number;
  returnCounter: number;
  expenseCounter: number;
  currentStaffId?: string;
  currentShiftId?: string;
  currentBranchId: string;
  // actions
  addOrder: (o: Order) => void;
  updateOrder: (id: string, patch: Partial<Order>) => void;
  refundOrder: (id: string) => void;
  addSalesReturn: (input: { orderId: string; items: OrderItem[]; reason?: string; refundMethod: PaymentMethod }) => SalesReturn | null;
  addManualSalesReturn: (input: { items: OrderItem[]; refundAmount: number; reason?: string; refundMethod: PaymentMethod }) => SalesReturn | null;
  setTableStatus: (id: string, status: Table["status"], orderId?: string) => void;
  upsertItem: (i: MenuItem) => void;
  deleteItem: (id: string) => void;
  upsertInventoryItem: (i: InventoryItem) => void;
  deleteInventoryItem: (id: string) => void;
  addInventoryCategory: (name: string) => void;
  renameInventoryCategory: (from: string, to: string) => void;
  deleteInventoryCategory: (name: string) => void;
  upsertCategory: (c: Category) => void;
  deleteCategory: (id: string) => void;
  upsertTable: (t: Table) => void;
  deleteTable: (id: string) => void;
  addExpenseCategory: (name: string) => void;
  deleteExpenseCategory: (name: string) => void;
  upsertCustomer: (c: Customer) => void;
  deleteCustomer: (id: string) => void;
  upsertPromotion: (p: Promotion) => void;
  deletePromotion: (id: string) => void;
  upsertTenant: (t: Tenant) => void;
  toggleTenantModule: (tenantId: string, mod: string) => void;
  upsertStaff: (s: Staff) => void;
  deleteStaff: (id: string) => void;
  upsertBranch: (b: Branch) => void;
  openShift: (staffId: string, openingCash: number) => string;
  closeShift: (id: string, closingCash: number, notes?: string) => void;
  addExpense: (e: Omit<Expense, "number">) => void;
  adjustStock: (itemId: string, qty: number, type: StockMove["type"], note?: string) => void;
  setStock: (itemId: string, patch: Partial<StockItem>) => void;
  adjustInventoryStock: (inventoryItemId: string, qty: number, type: InventoryMove["type"], note?: string) => void;
  setInventoryStock: (inventoryItemId: string, patch: Partial<InventoryItem>) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setCurrentStaff: (id?: string) => void;
  signInStaff: (pin: string) => Staff | null;
};

export const usePos = create<State>()(
  persist(
    (set, get) => ({
      categories: cats,
      items,
      tables,
      customers,
      promotions,
      orders: [],
      salesReturns: [],
      tenants,
      staff,
      branches,
      shifts: [],
      expenses: [],
      expenseCategories: ["Supplies", "Utilities", "Rent", "Salary", "Marketing", "Maintenance", "Misc"],
      stock,
      stockMoves: [],
      inventoryItems: [],
      inventoryMoves: [],
      inventoryCategories: ["Dry Goods", "Dairy", "Meat", "Vegetables", "Beverage", "Packaging", "Misc"],
      orderCounter: 1001,
      returnCounter: 9001,
      expenseCounter: 5001,
      currentBranchId: "b1",
      settings: {
        restaurantName: "Al Raziq POS",
        ntn: "1234567-8",
        strn: "32-77-9876-543-21",
        address: "Plot 12, MM Alam Road, Gulberg III, Lahore",
        phone: "042-111-222-333",
        currency: "PKR",
        taxRate: 16,
        serviceCharge: 10,
        pointsPer100: 1,
        receiptFooter: "Thank you for dining with us! آپ کا شکریہ",
        receiptHeaderUrdu: "خوش آمدید",
        fbr: { enabled: false, posId: "", apiKey: "", endpoint: "https://gw.fbr.gov.pk/imsp/v1/api", mode: "sandbox" },
        modules: { ...ALL_MODULES },
        paymentMethods: { cash: true, card: true, jazzcash: true, easypaisa: true, sadapay: true, nayapay: false },
        printer: { width: 80, copies: 1, autoOpenDrawer: true },
        theme: "light",
        blockPOSWhenOutOfStock: false,
      },
      addOrder: (o) => set((s) => {
        const updatedStock = s.stock.map((st) => {
          const used = o.items.filter((it) => it.itemId === st.itemId).reduce((sum, it) => sum + it.qty, 0);
          return used > 0 ? { ...st, stock: Math.max(0, st.stock - used) } : st;
        });
        const moves: StockMove[] = o.items.map((it) => ({
          id: crypto.randomUUID(), itemId: it.itemId, type: "out", qty: it.qty,
          note: `Order #${o.number}`, createdAt: Date.now(),
        }));
        let cust = s.customers;
        // Loyalty: award when payment was taken (POS always sets paymentMethod on checkout).
        const paidLike = o.paymentMethod && o.status !== "cancelled" && o.status !== "refunded";
        if (o.customerId && paidLike) {
          const pts = Math.floor(o.total / 100) * s.settings.pointsPer100;
          cust = s.customers.map((c) => c.id === o.customerId
            ? { ...c, points: c.points + pts, totalSpent: c.totalSpent + o.total, visits: c.visits + 1,
                tier: c.totalSpent + o.total >= 100000 ? "platinum" : c.totalSpent + o.total >= 50000 ? "gold" : c.totalSpent + o.total >= 20000 ? "silver" : "bronze" } : c);
          o = { ...o, pointsEarned: pts };
        }
        return {
          orders: [o, ...s.orders],
          orderCounter: s.orderCounter + 1,
          stock: updatedStock,
          stockMoves: [...moves, ...s.stockMoves],
          customers: cust,
        };
      }),
      updateOrder: (id, patch) => set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o)),
      })),
      refundOrder: (id) => set((s) => ({
        orders: s.orders.map((o) => (o.id === id ? { ...o, status: "refunded", updatedAt: Date.now() } : o)),
      })),
      addSalesReturn: ({ orderId, items: retItems, reason, refundMethod }) => {
        const s = get();
        const order = s.orders.find((o) => o.id === orderId);
        if (!order || retItems.length === 0) return null;
        const refundAmount = retItems.reduce((sum, it) => sum + it.price * it.qty, 0);
        const ret: SalesReturn = {
          id: crypto.randomUUID(),
          number: s.returnCounter,
          orderId,
          orderNumber: order.number,
          items: retItems,
          reason,
          refundAmount,
          refundMethod,
          staffId: s.currentStaffId,
          shiftId: s.currentShiftId,
          createdAt: Date.now(),
        };
        // restore stock
        const updatedStock = s.stock.map((st) => {
          const back = retItems.filter((it) => it.itemId === st.itemId).reduce((sum, it) => sum + it.qty, 0);
          return back > 0 ? { ...st, stock: st.stock + back } : st;
        });
        const moves: StockMove[] = retItems.map((it) => ({
          id: crypto.randomUUID(), itemId: it.itemId, type: "in", qty: it.qty,
          note: `Return #${ret.number} (Order #${order.number})`, createdAt: Date.now(),
        }));
        set({
          salesReturns: [ret, ...s.salesReturns],
          returnCounter: s.returnCounter + 1,
          stock: updatedStock,
          stockMoves: [...moves, ...s.stockMoves],
          orders: s.orders.map((o) => o.id === orderId ? { ...o, status: "refunded", updatedAt: Date.now() } : o),
        });
        return ret;
      },
      addManualSalesReturn: ({ items: retItems, refundAmount, reason, refundMethod }) => {
        const s = get();
        if (retItems.length === 0 || refundAmount <= 0) return null;
        const ret: SalesReturn = {
          id: crypto.randomUUID(),
          number: s.returnCounter,
          orderId: "manual",
          orderNumber: 0,
          items: retItems,
          reason,
          refundAmount,
          refundMethod,
          staffId: s.currentStaffId,
          shiftId: s.currentShiftId,
          createdAt: Date.now(),
        };
        // Manual returns are not tied to a known sold order, so no stock restore.
        set({
          salesReturns: [ret, ...s.salesReturns],
          returnCounter: s.returnCounter + 1,
        });
        return ret;
      },
      setTableStatus: (id, status, orderId) => set((s) => ({
        tables: s.tables.map((t) => (t.id === id ? { ...t, status, orderId } : t)),
      })),
      upsertItem: (i) => set((s) => ({
        items: s.items.find((x) => x.id === i.id) ? s.items.map((x) => (x.id === i.id ? i : x)) : [...s.items, i],
        stock: s.stock.find((x) => x.itemId === i.id) ? s.stock : [...s.stock, { itemId: i.id, stock: 50, reorder: 10, unit: "pcs" }],
      })),
      deleteItem: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      upsertInventoryItem: (i) => set((s) => ({
        inventoryItems: s.inventoryItems.find((x) => x.id === i.id)
          ? s.inventoryItems.map((x) => (x.id === i.id ? { ...i, updatedAt: Date.now() } : x))
          : [...s.inventoryItems, { ...i, createdAt: Date.now(), updatedAt: Date.now() }],
      })),
      deleteInventoryItem: (id) => set((s) => ({ inventoryItems: s.inventoryItems.filter((i) => i.id !== id) })),
      addInventoryCategory: (name) => set((s) => {
        const n = name.trim();
        if (!n || s.inventoryCategories.includes(n)) return {};
        return { inventoryCategories: [...s.inventoryCategories, n] };
      }),
      renameInventoryCategory: (from, to) => set((s) => {
        const next = to.trim();
        if (!from || !next) return {};
        return {
          inventoryCategories: s.inventoryCategories.map((c) => (c === from ? next : c)),
          inventoryItems: s.inventoryItems.map((i) => (i.category === from ? { ...i, category: next } : i)),
        };
      }),
      deleteInventoryCategory: (name) => set((s) => ({
        inventoryCategories: s.inventoryCategories.filter((c) => c !== name),
        inventoryItems: s.inventoryItems.map((i) => (i.category === name ? { ...i, category: "Uncategorized" } : i)),
      })),
      upsertCategory: (c) => set((s) => ({
        categories: s.categories.find((x) => x.id === c.id) ? s.categories.map((x) => (x.id === c.id ? c : x)) : [...s.categories, c],
      })),
      deleteCategory: (id) => set((s) => ({
        categories: s.categories.filter((c) => c.id !== id),
        items: s.items.filter((i) => i.categoryId !== id),
      })),
      upsertTable: (t) => set((s) => ({
        tables: s.tables.find((x) => x.id === t.id) ? s.tables.map((x) => (x.id === t.id ? t : x)) : [...s.tables, t],
      })),
      deleteTable: (id) => set((s) => ({ tables: s.tables.filter((t) => t.id !== id) })),
      addExpenseCategory: (name) => set((s) => s.expenseCategories.includes(name) ? {} : ({ expenseCategories: [...s.expenseCategories, name] })),
      deleteExpenseCategory: (name) => set((s) => ({ expenseCategories: s.expenseCategories.filter((c) => c !== name) })),
      upsertCustomer: (c) => set((s) => ({
        customers: s.customers.find((x) => x.id === c.id) ? s.customers.map((x) => (x.id === c.id ? c : x)) : [...s.customers, c],
      })),
      deleteCustomer: (id) => set((s) => ({ customers: s.customers.filter((c) => c.id !== id) })),
      upsertPromotion: (p) => set((s) => ({
        promotions: s.promotions.find((x) => x.id === p.id) ? s.promotions.map((x) => (x.id === p.id ? p : x)) : [...s.promotions, p],
      })),
      deletePromotion: (id) => set((s) => ({ promotions: s.promotions.filter((p) => p.id !== id) })),
      upsertTenant: (t) => set((s) => ({
        tenants: s.tenants.find((x) => x.id === t.id) ? s.tenants.map((x) => (x.id === t.id ? t : x)) : [...s.tenants, t],
      })),
      toggleTenantModule: (tenantId, mod) => set((s) => ({
        tenants: s.tenants.map((t) => t.id === tenantId ? { ...t, modules: { ...t.modules, [mod]: !t.modules[mod] } } : t),
      })),
      upsertStaff: (st) => set((s) => ({
        staff: s.staff.find((x) => x.id === st.id) ? s.staff.map((x) => (x.id === st.id ? st : x)) : [...s.staff, st],
      })),
      deleteStaff: (id) => set((s) => ({ staff: s.staff.filter((x) => x.id !== id) })),
      upsertBranch: (b) => set((s) => ({
        branches: s.branches.find((x) => x.id === b.id) ? s.branches.map((x) => (x.id === b.id ? b : x)) : [...s.branches, b],
      })),
      openShift: (staffId, openingCash) => {
        const id = crypto.randomUUID();
        set((s) => ({
          shifts: [{ id, staffId, branchId: s.currentBranchId, openedAt: Date.now(), openingCash }, ...s.shifts],
          currentShiftId: id,
        }));
        return id;
      },
      closeShift: (id, closingCash, notes) => set((s) => {
        const shift = s.shifts.find((x) => x.id === id);
        if (!shift) return {};
        // POS records payment with status "sent" (kitchen) — still settled sales for the drawer.
        const ordersInShift = s.orders.filter((o) => o.shiftId === id && o.paymentMethod && !["cancelled", "refunded"].includes(o.status));
        const cashSales = ordersInShift.reduce((sum, o) => sum + (o.paidCash || (o.paymentMethod === "cash" ? o.total : 0)), 0);
        const expensesInShift = s.expenses.filter((e) => e.shiftId === id).reduce((a, b) => a + b.amount, 0);
        const expected = shift.openingCash + cashSales - expensesInShift;
        return {
          shifts: s.shifts.map((x) => x.id === id ? { ...x, closedAt: Date.now(), closingCash, expectedCash: expected, notes } : x),
          currentShiftId: undefined,
        };
      }),
      addExpense: (e) => set((s) => ({
        expenses: [{ ...e, number: s.expenseCounter } as Expense, ...s.expenses],
        expenseCounter: s.expenseCounter + 1,
      })),
      adjustStock: (itemId, qty, type, note) => set((s) => ({
        stock: s.stock.map((x) => x.itemId === itemId ? { ...x, stock: type === "in" ? x.stock + qty : type === "adjust" ? qty : Math.max(0, x.stock - qty) } : x),
        stockMoves: [{ id: crypto.randomUUID(), itemId, type, qty, note, createdAt: Date.now() }, ...s.stockMoves],
      })),
      setStock: (itemId, patch) => set((s) => ({
        stock: s.stock.map((x) => x.itemId === itemId ? { ...x, ...patch } : x),
      })),
      adjustInventoryStock: (itemId, qty, type, note) => set((s) => ({
        inventoryItems: s.inventoryItems.map((x) => x.id === itemId ? { ...x, stock: type === "in" ? x.stock + qty : type === "adjust" ? qty : Math.max(0, x.stock - qty), updatedAt: Date.now() } : x),
        inventoryMoves: [{ id: crypto.randomUUID(), inventoryItemId: itemId, type, qty, note, createdAt: Date.now() }, ...s.inventoryMoves],
      })),
      setInventoryStock: (itemId, patch) => set((s) => ({
        inventoryItems: s.inventoryItems.map((x) => x.id === itemId ? { ...x, ...patch, updatedAt: Date.now() } : x),
      })),
      updateSettings: (patch) => set((s) => {
        const next: Settings = {
          ...s.settings,
          ...patch,
          fbr: patch.fbr ? { ...s.settings.fbr, ...patch.fbr } : s.settings.fbr,
          modules: patch.modules ? { ...s.settings.modules, ...patch.modules } : s.settings.modules,
          paymentMethods: patch.paymentMethods
            ? { ...s.settings.paymentMethods, ...patch.paymentMethods }
            : s.settings.paymentMethods,
          printer: patch.printer ? { ...s.settings.printer, ...patch.printer } : s.settings.printer,
        };
        if (!Object.values(next.paymentMethods).some(Boolean)) {
          next.paymentMethods = { cash: true, card: true, jazzcash: true, easypaisa: true, sadapay: true, nayapay: false };
        }
        return { settings: next };
      }),
      setCurrentStaff: (id) => set({ currentStaffId: id }),
      signInStaff: (pin) => {
        const s = get().staff.find((x) => x.pin === pin && x.active);
        if (s) set({ currentStaffId: s.id });
        return s || null;
      },
    }),
    {
      name: "pos-store-v4",
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const base = current as State;
        const next: State = {
          ...base,
          ...p,
          settings: {
            ...base.settings,
            ...p.settings,
            fbr: { ...base.settings.fbr, ...p.settings?.fbr },
            modules: { ...ALL_MODULES, ...(p.settings?.modules ?? {}) },
            paymentMethods: {
              cash: true,
              card: true,
              jazzcash: true,
              easypaisa: true,
              sadapay: true,
              nayapay: false,
              ...(p.settings?.paymentMethods ?? {}),
            },
            printer: { ...base.settings.printer, ...p.settings?.printer },
            blockPOSWhenOutOfStock: p.settings?.blockPOSWhenOutOfStock ?? base.settings.blockPOSWhenOutOfStock,
          },
        };
        if (!Object.values(next.settings.paymentMethods).some(Boolean)) {
          next.settings.paymentMethods = {
            cash: true, card: true, jazzcash: true, easypaisa: true, sadapay: true, nayapay: false,
          };
        }
        // Corrupt / empty persisted menu (bad LAN pull, cleared storage, partial JSON)
        if (next.categories.length === 0 && next.items.length === 0) {
          next.categories = cats;
          next.items = items;
          next.stock = items.map((it, idx) => ({
            itemId: it.id,
            stock: 50 + (idx % 40),
            reorder: 10,
            unit: "pcs",
          }));
        }
        const byId = new Set(next.stock.map((x) => x.itemId));
        for (const it of next.items) {
          if (!byId.has(it.id)) {
            next.stock.push({ itemId: it.id, stock: 50, reorder: 10, unit: "pcs" });
            byId.add(it.id);
          }
        }
        if (!next.inventoryCategories?.length) {
          next.inventoryCategories = base.inventoryCategories;
        }
        if (!next.expenseCategories?.length) {
          next.expenseCategories = base.expenseCategories;
        }
        if (next.inventoryItems === undefined) next.inventoryItems = [];
        if (next.inventoryMoves === undefined) next.inventoryMoves = [];

        // One-time migration: if inventoryItems is empty, but items have inventoryCategory,
        // we COULD migrate them, but the user wants them decoupled.
        // Let's just ensure the arrays exist.
        // Never leave the app with no staff (can't unlock) or no owner row
        if (!next.staff?.length || !next.staff.some((x) => x.role === "owner")) {
          next.staff = base.staff;
        }
        return next;
      },
    },
  )
);

export const MODULE_LIST = [
  { key: "pos", label: "POS / Order Taking" },
  { key: "kds", label: "Kitchen Display (KDS)" },
  { key: "tables", label: "Table Management" },
  { key: "menu", label: "Menu Management" },
  { key: "inventory", label: "Inventory" },
  { key: "orders", label: "Order History" },
  { key: "customers", label: "Customers & Loyalty" },
  { key: "promotions", label: "Promotions & Discounts" },
  { key: "reports", label: "Reports & Insights" },
  { key: "staff", label: "Staff & Roles" },
  { key: "shifts", label: "Shifts & Cash Drawer" },
  { key: "expenses", label: "Expenses" },
  { key: "fbr", label: "FBR POS Integration" },
  { key: "multiBranch", label: "Multi-Branch" },
];

export function fmtMoney(n: number, currency = "PKR") {
  return `${currency} ${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

// FBR invoice number generator (mock — matches real FBR format pattern)
export function generateFbrInvoice(posId: string) {
  const ts = new Date();
  const yyyy = ts.getFullYear();
  const mm = String(ts.getMonth() + 1).padStart(2, "0");
  const dd = String(ts.getDate()).padStart(2, "0");
  const seq = String(Math.floor(Math.random() * 999999)).padStart(6, "0");
  return `${posId || "0000000"}-${yyyy}${mm}${dd}-${seq}`;
}
