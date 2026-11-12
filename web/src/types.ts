export type Status = "ready" | "needs_review" | "needs_approval" | "duplicate" | "approved" | "rejected" | "paid";

export interface LineItem { description: string; quantity: number | null; unit_price: number | null; amount: number | null }
export interface Flag { code: string; message: string }

export interface Invoice {
  id: number;
  created_at: string;
  file_name: string | null;
  vendor: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  currency: string;
  subtotal: string | number | null;   // Postgres numeric arrives as text
  tax: string | number;
  total: string | number | null;
  line_items: LineItem[];
  flags: Flag[];
  status: Status;
  is_sample: boolean;
  mine?: boolean;       // uploaded in this browser session
}
