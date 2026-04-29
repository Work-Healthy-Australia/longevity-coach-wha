"use client";

import { useState } from "react";
import "./suppliers.css";

/* ------------------------------------------------------------------ */
/* Types                                                                 */
/* ------------------------------------------------------------------ */

export type Supplier = {
  id: string;
  name: string;
  supplier_type: string | null;
  legal_entity_name: string | null;
  abn: string | null;
  primary_contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  primary_contact_phone: string | null;
  website: string | null;
  address: string | null;
  billing_email: string | null;
  accounts_contact_name: string | null;
  accounts_contact_email: string | null;
  invoice_terms: string | null;
  payment_terms: string | null;
  preferred_payment_method: string | null;
  bank_account_name: string | null;
  bsb: string | null;
  bank_account_number: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  contract_status: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  supplier_id: string;
  product_code: string;
  name: string;
  category: string;
  description: string | null;
  product_type: string | null;
  unit_type: string | null;
  subscription_type: string;
  delivery_method: string | null;
  retail_cents: number;
  wholesale_cents: number;
  gst_applicable: boolean;
  minimum_order_qty: number;
  lead_time_days: number | null;
  stripe_price_id: string | null;
  is_active: boolean;
  internal_notes: string | null;
};

/* ------------------------------------------------------------------ */
/* Helpers                                                               */
/* ------------------------------------------------------------------ */

function formatDate(d: string | null): string {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

function centsToDisplay(n: number): string {
  return "$" + (n / 100).toFixed(2);
}

async function apiJson(method: string, url: string, body?: unknown): Promise<void> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
  }
}

function contractPillClass(status: string | null): string {
  switch (status) {
    case "active":     return "pill-contract-active";
    case "pending":    return "pill-contract-pending";
    case "expired":    return "pill-contract-expired";
    case "terminated": return "pill-contract-terminated";
    default:           return "pill-contract-none";
  }
}

/* ------------------------------------------------------------------ */
/* Sub-component: Product row inline edit                               */
/* ------------------------------------------------------------------ */

type ProductEditProps = {
  product: Product;
  onSave: (updated: Product) => void;
  onCancel: () => void;
};

function ProductEditForm({ product, onSave, onCancel }: ProductEditProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const retailDollars = parseFloat((fd.get("retail_dollars") as string) || "0");
    const wholeDollars  = parseFloat((fd.get("wholesale_dollars") as string) || "0");
    const body = {
      product_code:      (fd.get("product_code") as string).trim(),
      name:              (fd.get("name") as string).trim(),
      category:          fd.get("category") as string,
      description:       (fd.get("description") as string) || null,
      product_type:      (fd.get("product_type") as string) || null,
      unit_type:         (fd.get("unit_type") as string) || null,
      subscription_type: fd.get("subscription_type") as string,
      delivery_method:   (fd.get("delivery_method") as string) || null,
      retail_cents:      Math.round(retailDollars * 100),
      wholesale_cents:   Math.round(wholeDollars * 100),
      gst_applicable:    (fd.get("gst_applicable") as string) === "on",
      minimum_order_qty: parseInt((fd.get("minimum_order_qty") as string) || "1", 10),
      lead_time_days:    fd.get("lead_time_days") ? parseInt(fd.get("lead_time_days") as string, 10) : null,
      stripe_price_id:   (fd.get("stripe_price_id") as string) || null,
      internal_notes:    (fd.get("internal_notes") as string) || null,
    };
    try {
      await apiJson("PUT", `/api/admin/products/${product.id}`, body);
      onSave({
        ...product,
        ...body,
        retail_cents:    body.retail_cents,
        wholesale_cents: body.wholesale_cents,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr>
      <td colSpan={9} style={{ padding: 0 }}>
        <div className="product-inline-form">
          {error && <div className="suppliers-error">{error}</div>}
          <form onSubmit={handleSubmit}>
            <div className="form-2col">
              <div className="form-field">
                <label className="form-label">Product Code *</label>
                <input className="form-input" name="product_code" defaultValue={product.product_code} required />
              </div>
              <div className="form-field">
                <label className="form-label">Name *</label>
                <input className="form-input" name="name" defaultValue={product.name} required />
              </div>
              <div className="form-field">
                <label className="form-label">Category *</label>
                <select className="form-select" name="category" defaultValue={product.category}>
                  <option value="imaging">Imaging</option>
                  <option value="pathology">Pathology</option>
                  <option value="genomics">Genomics</option>
                  <option value="hormonal">Hormonal</option>
                  <option value="microbiome">Microbiome</option>
                  <option value="supplements">Supplements</option>
                  <option value="fitness">Fitness</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Product Type</label>
                <select className="form-select" name="product_type" defaultValue={product.product_type ?? ""}>
                  <option value="">—</option>
                  <option value="product">Product</option>
                  <option value="service">Service</option>
                  <option value="test">Test</option>
                  <option value="scan">Scan</option>
                  <option value="session">Session</option>
                  <option value="subscription">Subscription</option>
                  <option value="bundle">Bundle</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Unit Type</label>
                <select className="form-select" name="unit_type" defaultValue={product.unit_type ?? ""}>
                  <option value="">—</option>
                  <option value="per_test">Per test</option>
                  <option value="per_scan">Per scan</option>
                  <option value="per_session">Per session</option>
                  <option value="per_month">Per month</option>
                  <option value="per_year">Per year</option>
                  <option value="per_unit">Per unit</option>
                  <option value="per_employee">Per employee</option>
                  <option value="per_patient">Per patient</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Subscription Type *</label>
                <select className="form-select" name="subscription_type" defaultValue={product.subscription_type}>
                  <option value="one_time">One-time</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Delivery Method</label>
                <select className="form-select" name="delivery_method" defaultValue={product.delivery_method ?? ""}>
                  <option value="">—</option>
                  <option value="digital">Digital</option>
                  <option value="in_person">In person</option>
                  <option value="shipped">Shipped</option>
                  <option value="referral">Referral</option>
                  <option value="lab">Lab</option>
                  <option value="clinic">Clinic</option>
                  <option value="telehealth">Telehealth</option>
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Retail Price ($) *</label>
                <input className="form-input" name="retail_dollars" type="number" step="0.01" min="0" defaultValue={(product.retail_cents / 100).toFixed(2)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Wholesale Price ($) *</label>
                <input className="form-input" name="wholesale_dollars" type="number" step="0.01" min="0" defaultValue={(product.wholesale_cents / 100).toFixed(2)} required />
              </div>
              <div className="form-field">
                <label className="form-label">Min. Order Qty</label>
                <input className="form-input" name="minimum_order_qty" type="number" min="1" defaultValue={product.minimum_order_qty} />
              </div>
              <div className="form-field">
                <label className="form-label">Lead Time (days)</label>
                <input className="form-input" name="lead_time_days" type="number" min="0" defaultValue={product.lead_time_days ?? ""} />
              </div>
              <div className="form-field">
                <label className="form-label">Stripe Price ID</label>
                <input className="form-input" name="stripe_price_id" defaultValue={product.stripe_price_id ?? ""} />
              </div>
              <div className="form-field">
                <label className="form-label">GST Applicable</label>
                <div className="form-checkbox-row">
                  <input type="checkbox" name="gst_applicable" id={`gst-edit-${product.id}`} defaultChecked={product.gst_applicable} />
                  <label htmlFor={`gst-edit-${product.id}`} style={{ fontSize: 13, color: "#1A3A4A" }}>Yes</label>
                </div>
              </div>
              <div className="form-field form-full">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" name="description" defaultValue={product.description ?? ""} />
              </div>
              <div className="form-field form-full">
                <label className="form-label">Internal Notes</label>
                <textarea className="form-textarea" name="internal_notes" defaultValue={product.internal_notes ?? ""} />
              </div>
            </div>
            <div className="form-actions">
              <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
              <button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : "Save Product"}</button>
            </div>
          </form>
        </div>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-component: Add Product inline form                               */
/* ------------------------------------------------------------------ */

type AddProductFormProps = {
  supplierId: string;
  onSave: (product: Product) => void;
  onCancel: () => void;
};

function AddProductForm({ supplierId, onSave, onCancel }: AddProductFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const retailDollars = parseFloat((fd.get("retail_dollars") as string) || "0");
    const wholeDollars  = parseFloat((fd.get("wholesale_dollars") as string) || "0");
    const body = {
      supplier_id:       supplierId,
      product_code:      (fd.get("product_code") as string).trim(),
      name:              (fd.get("name") as string).trim(),
      category:          fd.get("category") as string,
      description:       (fd.get("description") as string) || null,
      product_type:      (fd.get("product_type") as string) || null,
      unit_type:         (fd.get("unit_type") as string) || null,
      subscription_type: fd.get("subscription_type") as string,
      delivery_method:   (fd.get("delivery_method") as string) || null,
      retail_cents:      Math.round(retailDollars * 100),
      wholesale_cents:   Math.round(wholeDollars * 100),
      gst_applicable:    (fd.get("gst_applicable") as string) === "on",
      minimum_order_qty: parseInt((fd.get("minimum_order_qty") as string) || "1", 10),
      lead_time_days:    fd.get("lead_time_days") ? parseInt(fd.get("lead_time_days") as string, 10) : null,
      stripe_price_id:   (fd.get("stripe_price_id") as string) || null,
      internal_notes:    (fd.get("internal_notes") as string) || null,
      is_active:         true,
    };
    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      const { id } = await res.json() as { id: string };
      onSave({ ...body, id, is_active: true, internal_notes: body.internal_notes });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="product-inline-form" style={{ borderTop: "1px solid #D4E0E8", marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#1A3A4A", marginBottom: 14 }}>Add Product</div>
      {error && <div className="suppliers-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-2col">
          <div className="form-field">
            <label className="form-label">Product Code *</label>
            <input className="form-input" name="product_code" required />
          </div>
          <div className="form-field">
            <label className="form-label">Name *</label>
            <input className="form-input" name="name" required />
          </div>
          <div className="form-field">
            <label className="form-label">Category *</label>
            <select className="form-select" name="category" defaultValue="other">
              <option value="imaging">Imaging</option>
              <option value="pathology">Pathology</option>
              <option value="genomics">Genomics</option>
              <option value="hormonal">Hormonal</option>
              <option value="microbiome">Microbiome</option>
              <option value="supplements">Supplements</option>
              <option value="fitness">Fitness</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Product Type</label>
            <select className="form-select" name="product_type" defaultValue="">
              <option value="">—</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
              <option value="test">Test</option>
              <option value="scan">Scan</option>
              <option value="session">Session</option>
              <option value="subscription">Subscription</option>
              <option value="bundle">Bundle</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Unit Type</label>
            <select className="form-select" name="unit_type" defaultValue="">
              <option value="">—</option>
              <option value="per_test">Per test</option>
              <option value="per_scan">Per scan</option>
              <option value="per_session">Per session</option>
              <option value="per_month">Per month</option>
              <option value="per_year">Per year</option>
              <option value="per_unit">Per unit</option>
              <option value="per_employee">Per employee</option>
              <option value="per_patient">Per patient</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Subscription Type *</label>
            <select className="form-select" name="subscription_type" defaultValue="one_time">
              <option value="one_time">One-time</option>
              <option value="recurring">Recurring</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Delivery Method</label>
            <select className="form-select" name="delivery_method" defaultValue="">
              <option value="">—</option>
              <option value="digital">Digital</option>
              <option value="in_person">In person</option>
              <option value="shipped">Shipped</option>
              <option value="referral">Referral</option>
              <option value="lab">Lab</option>
              <option value="clinic">Clinic</option>
              <option value="telehealth">Telehealth</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Retail Price ($) *</label>
            <input className="form-input" name="retail_dollars" type="number" step="0.01" min="0" defaultValue="0" required />
          </div>
          <div className="form-field">
            <label className="form-label">Wholesale Price ($) *</label>
            <input className="form-input" name="wholesale_dollars" type="number" step="0.01" min="0" defaultValue="0" required />
          </div>
          <div className="form-field">
            <label className="form-label">Min. Order Qty</label>
            <input className="form-input" name="minimum_order_qty" type="number" min="1" defaultValue="1" />
          </div>
          <div className="form-field">
            <label className="form-label">Lead Time (days)</label>
            <input className="form-input" name="lead_time_days" type="number" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Stripe Price ID</label>
            <input className="form-input" name="stripe_price_id" />
          </div>
          <div className="form-field">
            <label className="form-label">GST Applicable</label>
            <div className="form-checkbox-row">
              <input type="checkbox" name="gst_applicable" id={`gst-add-${supplierId}`} defaultChecked />
              <label htmlFor={`gst-add-${supplierId}`} style={{ fontSize: 13, color: "#1A3A4A" }}>Yes</label>
            </div>
          </div>
          <div className="form-field form-full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" name="description" />
          </div>
          <div className="form-field form-full">
            <label className="form-label">Internal Notes</label>
            <textarea className="form-textarea" name="internal_notes" />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : "Add Product"}</button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sub-component: Supplier edit form (inline panel)                     */
/* ------------------------------------------------------------------ */

type SupplierFormProps = {
  supplier?: Supplier;
  onSave: (updated: Supplier) => void;
  onCancel: () => void;
  isNew?: boolean;
};

function SupplierForm({ supplier, onSave, onCancel, isNew = false }: SupplierFormProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => (fd.get(k) as string | null)?.trim() || null;
    const body = {
      name:                     (fd.get("name") as string).trim(),
      supplier_type:            s("supplier_type"),
      legal_entity_name:        s("legal_entity_name"),
      abn:                      s("abn"),
      primary_contact_name:     s("primary_contact_name"),
      contact_email:            s("contact_email"),
      contact_phone:            s("contact_phone"),
      primary_contact_phone:    s("primary_contact_phone"),
      website:                  s("website"),
      address:                  s("address"),
      billing_email:            s("billing_email"),
      accounts_contact_name:    s("accounts_contact_name"),
      accounts_contact_email:   s("accounts_contact_email"),
      invoice_terms:            s("invoice_terms"),
      payment_terms:            s("payment_terms"),
      preferred_payment_method: s("preferred_payment_method"),
      bank_account_name:        s("bank_account_name"),
      bsb:                      s("bsb"),
      bank_account_number:      s("bank_account_number"),
      contract_start_date:      s("contract_start_date"),
      contract_end_date:        s("contract_end_date"),
      contract_status:          s("contract_status"),
      notes:                    s("notes"),
      is_active:                (fd.get("is_active") as string) === "on",
    };
    try {
      if (isNew) {
        const res = await fetch("/api/admin/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, is_active: true }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error((j as { error?: string }).error ?? `Request failed (${res.status})`);
        }
        const { id } = await res.json() as { id: string };
        onSave({ ...body, id, is_active: true, created_at: new Date().toISOString() });
      } else {
        await apiJson("PUT", `/api/admin/suppliers/${supplier!.id}`, body);
        onSave({ ...supplier!, ...body });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const v = (k: keyof Supplier) => (supplier ? String(supplier[k] ?? "") : "");

  return (
    <div>
      {error && <div className="suppliers-error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="form-2col">
          {/* Basic */}
          <div className="form-field">
            <label className="form-label">Name *</label>
            <input className="form-input" name="name" defaultValue={v("name")} required />
          </div>
          <div className="form-field">
            <label className="form-label">Supplier Type</label>
            <select className="form-select" name="supplier_type" defaultValue={v("supplier_type")}>
              <option value="">—</option>
              <option value="Pathology">Pathology</option>
              <option value="Imaging">Imaging</option>
              <option value="Genomics">Genomics</option>
              <option value="Supplements">Supplements</option>
              <option value="Fitness">Fitness</option>
              <option value="Technology">Technology</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Legal Entity Name</label>
            <input className="form-input" name="legal_entity_name" defaultValue={v("legal_entity_name")} />
          </div>
          <div className="form-field">
            <label className="form-label">ABN</label>
            <input className="form-input" name="abn" defaultValue={v("abn")} />
          </div>

          {/* Contact */}
          <div className="form-field">
            <label className="form-label">Primary Contact Name</label>
            <input className="form-input" name="primary_contact_name" defaultValue={v("primary_contact_name")} />
          </div>
          <div className="form-field">
            <label className="form-label">Contact Email</label>
            <input className="form-input" name="contact_email" type="email" defaultValue={v("contact_email")} />
          </div>
          <div className="form-field">
            <label className="form-label">Contact Phone</label>
            <input className="form-input" name="contact_phone" defaultValue={v("contact_phone")} />
          </div>
          <div className="form-field">
            <label className="form-label">Primary Contact Phone</label>
            <input className="form-input" name="primary_contact_phone" defaultValue={v("primary_contact_phone")} />
          </div>
          <div className="form-field">
            <label className="form-label">Website</label>
            <input className="form-input" name="website" defaultValue={v("website")} />
          </div>
          <div className="form-field">
            <label className="form-label">Address</label>
            <input className="form-input" name="address" defaultValue={v("address")} />
          </div>

          {/* Billing */}
          <div className="form-field">
            <label className="form-label">Billing Email</label>
            <input className="form-input" name="billing_email" type="email" defaultValue={v("billing_email")} />
          </div>
          <div className="form-field">
            <label className="form-label">Accounts Contact Name</label>
            <input className="form-input" name="accounts_contact_name" defaultValue={v("accounts_contact_name")} />
          </div>
          <div className="form-field">
            <label className="form-label">Accounts Contact Email</label>
            <input className="form-input" name="accounts_contact_email" type="email" defaultValue={v("accounts_contact_email")} />
          </div>
          <div className="form-field">
            <label className="form-label">Invoice Terms</label>
            <input className="form-input" name="invoice_terms" defaultValue={v("invoice_terms")} placeholder="e.g. Monthly" />
          </div>
          <div className="form-field">
            <label className="form-label">Payment Terms</label>
            <input className="form-input" name="payment_terms" defaultValue={v("payment_terms")} placeholder="e.g. Net 30" />
          </div>
          <div className="form-field">
            <label className="form-label">Preferred Payment Method</label>
            <input className="form-input" name="preferred_payment_method" defaultValue={v("preferred_payment_method")} placeholder="e.g. EFT" />
          </div>
          <div className="form-field">
            <label className="form-label">Bank Account Name</label>
            <input className="form-input" name="bank_account_name" defaultValue={v("bank_account_name")} />
          </div>
          <div className="form-field">
            <label className="form-label">BSB</label>
            <input className="form-input" name="bsb" defaultValue={v("bsb")} />
          </div>
          <div className="form-field">
            <label className="form-label">Bank Account Number</label>
            <input className="form-input" name="bank_account_number" defaultValue={v("bank_account_number")} />
          </div>

          {/* Contract */}
          <div className="form-field">
            <label className="form-label">Contract Start Date</label>
            <input className="form-input" name="contract_start_date" type="date" defaultValue={v("contract_start_date")} />
          </div>
          <div className="form-field">
            <label className="form-label">Contract End Date</label>
            <input className="form-input" name="contract_end_date" type="date" defaultValue={v("contract_end_date")} />
          </div>
          <div className="form-field">
            <label className="form-label">Contract Status</label>
            <select className="form-select" name="contract_status" defaultValue={v("contract_status")}>
              <option value="">—</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
              <option value="expired">Expired</option>
              <option value="terminated">Terminated</option>
            </select>
          </div>
          {!isNew && (
            <div className="form-field">
              <label className="form-label">Active</label>
              <div className="form-checkbox-row">
                <input type="checkbox" name="is_active" id={`active-${supplier?.id ?? "new"}`} defaultChecked={supplier?.is_active ?? true} />
                <label htmlFor={`active-${supplier?.id ?? "new"}`} style={{ fontSize: 13, color: "#1A3A4A" }}>Supplier is active</label>
              </div>
            </div>
          )}
          <div className="form-field form-full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" name="notes" defaultValue={v("notes")} />
          </div>
        </div>
        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn-save" disabled={saving}>{saving ? "Saving…" : isNew ? "Create Supplier" : "Save Changes"}</button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main client component                                                 */
/* ------------------------------------------------------------------ */

type Props = {
  suppliers: Supplier[];
  allProducts: Product[];
};

export function SuppliersClient({ suppliers: initialSuppliers, allProducts: initialProducts }: Props) {
  const [suppliers, setSuppliers]     = useState<Supplier[]>(initialSuppliers);
  const [products, setProducts]       = useState<Product[]>(initialProducts);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [editingSupplierId, setEditingSupplierId]     = useState<string | null>(null);
  const [addingProductForId, setAddingProductForId]   = useState<string | null>(null);
  const [editingProductId, setEditingProductId]       = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  function toggleExpand(id: string) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  function supplierProducts(supplierId: string) {
    return products.filter(p => p.supplier_id === supplierId);
  }

  function handleSupplierSaved(updated: Supplier) {
    setSuppliers(prev => {
      const idx = prev.findIndex(s => s.id === updated.id);
      if (idx === -1) return [updated, ...prev];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setEditingSupplierId(null);
    setShowAddForm(false);
    setError(null);
  }

  function handleProductSaved(updated: Product) {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === updated.id);
      if (idx === -1) return [...prev, updated];
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
    setEditingProductId(null);
    setAddingProductForId(null);
    setError(null);
  }

  return (
    <div className="suppliers-page">
      {/* Page header */}
      <div className="suppliers-header">
        <div className="suppliers-header-text">
          <h1>Suppliers</h1>
          <p>/admin/suppliers — manage supplier partners and their products</p>
        </div>
        <button className="btn-add-supplier" onClick={() => { setShowAddForm(true); setEditingSupplierId(null); }}>
          + Add Supplier
        </button>
      </div>

      {error && <div className="suppliers-error">{error}</div>}

      {/* Add supplier card */}
      {showAddForm && (
        <div className="add-supplier-card">
          <div className="add-supplier-card-header">New Supplier</div>
          <div className="add-supplier-card-body">
            <SupplierForm
              isNew
              onSave={handleSupplierSaved}
              onCancel={() => setShowAddForm(false)}
            />
          </div>
        </div>
      )}

      {/* Supplier cards */}
      {suppliers.map(supplier => {
        const isExpanded  = expandedId === supplier.id;
        const isEditing   = editingSupplierId === supplier.id;
        const supProducts = supplierProducts(supplier.id);

        return (
          <div key={supplier.id} className="supplier-card">
            {/* Header row */}
            <div
              className={`supplier-header-row${isExpanded ? " expanded" : ""}`}
              onClick={() => {
                toggleExpand(supplier.id);
                if (isEditing) setEditingSupplierId(null);
                if (addingProductForId === supplier.id) setAddingProductForId(null);
              }}
            >
              <span className={`supplier-chevron${isExpanded ? " open" : ""}`}>&#9654;</span>
              <div className="supplier-header-info">
                <div className="supplier-name">{supplier.name}</div>
                <div className="supplier-subtitle">
                  {supplier.supplier_type ?? "Supplier"}
                  {supplier.abn ? ` · ABN ${supplier.abn}` : ""}
                </div>
              </div>
              {supplier.supplier_type && (
                <span className="supplier-type-pill">{supplier.supplier_type}</span>
              )}
              <span className={supplier.is_active ? "pill-active" : "pill-inactive"}>
                {supplier.is_active ? "Active" : "Inactive"}
              </span>
              <span className="supplier-product-count">{supProducts.length} product{supProducts.length !== 1 ? "s" : ""}</span>
            </div>

            {/* Expanded body */}
            <div className={`supplier-body${isExpanded ? " open" : ""}`}>
              {/* 2-col contact/billing */}
              <div className="detail-grid-2col">
                {/* Left: Contact */}
                <div className="contact-col">
                  <div className="detail-section-title">Contact details</div>
                  <div className="detail-kv">
                    <span className="detail-label">Legal entity</span>
                    <span className="detail-val">{supplier.legal_entity_name ?? "—"}</span>

                    <span className="detail-label">ABN</span>
                    <span className="detail-val">{supplier.abn ?? "—"}</span>

                    <span className="detail-label">Type</span>
                    <span className="detail-val">{supplier.supplier_type ?? "—"}</span>

                    <span className="detail-label">Primary contact</span>
                    <span className="detail-val">{supplier.primary_contact_name ?? "—"}</span>

                    <span className="detail-label">Email</span>
                    <span className="detail-val">{supplier.contact_email ?? "—"}</span>

                    <span className="detail-label">Phone</span>
                    <span className="detail-val">{supplier.contact_phone ?? supplier.primary_contact_phone ?? "—"}</span>

                    <span className="detail-label">Website</span>
                    <span className="detail-val">
                      {supplier.website
                        ? <a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noreferrer">{supplier.website}</a>
                        : "—"}
                    </span>

                    <span className="detail-label">Address</span>
                    <span className="detail-val">{supplier.address ?? "—"}</span>
                  </div>
                </div>

                {/* Right: Billing */}
                <div className="billing-col">
                  <div className="detail-section-title">Billing &amp; contract</div>
                  <div className="detail-kv" style={{ marginBottom: 16 }}>
                    <span className="detail-label">Billing email</span>
                    <span className="detail-val">{supplier.billing_email ?? "—"}</span>

                    <span className="detail-label">Accounts contact</span>
                    <span className="detail-val">{supplier.accounts_contact_name ?? "—"}</span>

                    <span className="detail-label">Invoice terms</span>
                    <span className="detail-val">{supplier.invoice_terms ?? "—"}</span>

                    <span className="detail-label">Payment terms</span>
                    <span className="detail-val">{supplier.payment_terms ?? "—"}</span>

                    <span className="detail-label">Preferred method</span>
                    <span className="detail-val">{supplier.preferred_payment_method ?? "—"}</span>

                    <span className="detail-label">BSB / Account</span>
                    <span className="detail-val">
                      {supplier.bsb || supplier.bank_account_number
                        ? `${supplier.bsb ?? "—"} / ${supplier.bank_account_number ?? "—"}`
                        : "—"}
                    </span>

                    <span className="detail-label">Contract</span>
                    <span className="detail-val">
                      {supplier.contract_start_date || supplier.contract_end_date
                        ? `${formatDate(supplier.contract_start_date)} → ${formatDate(supplier.contract_end_date)}`
                        : "—"}
                    </span>

                    <span className="detail-label">Contract status</span>
                    <span className="detail-val">
                      {supplier.contract_status
                        ? <span className={contractPillClass(supplier.contract_status)}>{supplier.contract_status}</span>
                        : "—"}
                    </span>
                  </div>
                  <div className="billing-col-actions">
                    <button
                      className="btn-edit-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSupplierId(prev => (prev === supplier.id ? null : supplier.id));
                        setAddingProductForId(null);
                      }}
                    >
                      {isEditing ? "Close" : "Edit supplier"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Supplier edit form (inline) */}
              {isEditing && (
                <div className="supplier-edit-panel">
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1A3A4A", marginBottom: 14 }}>
                    Edit Supplier
                  </div>
                  <SupplierForm
                    supplier={supplier}
                    onSave={handleSupplierSaved}
                    onCancel={() => setEditingSupplierId(null)}
                  />
                </div>
              )}

              {/* Products section */}
              <div className="product-section">
                <div className="product-section-header">
                  <div className="product-section-title">
                    Products <span>({supProducts.length})</span>
                  </div>
                  <button
                    className="btn-add-product"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddingProductForId(prev => (prev === supplier.id ? null : supplier.id));
                      setEditingProductId(null);
                    }}
                  >
                    + Add Product
                  </button>
                </div>

                {supProducts.length === 0 && addingProductForId !== supplier.id ? (
                  <p style={{ fontSize: 13, color: "#9AABBA", margin: "0 0 8px" }}>No products yet.</p>
                ) : (
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Type</th>
                        <th>Sub</th>
                        <th className="right">Retail</th>
                        <th className="right">Wholesale</th>
                        <th className="center">Status</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {supProducts.map(product => (
                        <>
                          <tr key={product.id}>
                            <td><span className="product-code-cell">{product.product_code}</span></td>
                            <td><span className="product-name-cell">{product.name}</span></td>
                            <td><span className="cat-pill">{product.category}</span></td>
                            <td style={{ color: "#6B7C85" }}>{product.product_type ?? "—"}</td>
                            <td>
                              {product.subscription_type === "recurring"
                                ? <span className="sub-icon-recurring" title="Recurring">↻</span>
                                : <span className="sub-icon-onetime" title="One-time">1×</span>}
                            </td>
                            <td className="right">{centsToDisplay(product.retail_cents)}</td>
                            <td className="right" style={{ color: "#6B7C85" }}>{centsToDisplay(product.wholesale_cents)}</td>
                            <td className="center">
                              <span className={product.is_active ? "pill-active" : "pill-inactive"}>
                                {product.is_active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <button
                                className="btn-edit-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProductId(prev => (prev === product.id ? null : product.id));
                                  setAddingProductForId(null);
                                }}
                              >
                                {editingProductId === product.id ? "Close" : "Edit"}
                              </button>
                            </td>
                          </tr>
                          {editingProductId === product.id && (
                            <ProductEditForm
                              key={`edit-${product.id}`}
                              product={product}
                              onSave={handleProductSaved}
                              onCancel={() => setEditingProductId(null)}
                            />
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Add product form */}
                {addingProductForId === supplier.id && (
                  <AddProductForm
                    supplierId={supplier.id}
                    onSave={handleProductSaved}
                    onCancel={() => setAddingProductForId(null)}
                  />
                )}

                <p className="products-legend">1× = one-time order &nbsp;·&nbsp; ↻ = recurring subscription &nbsp;·&nbsp; Wholesale visible to admin only</p>
              </div>
            </div>
          </div>
        );
      })}

      {suppliers.length === 0 && !showAddForm && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#9AABBA", fontSize: 14 }}>
          No suppliers yet. Click &ldquo;+ Add Supplier&rdquo; to create one.
        </div>
      )}
    </div>
  );
}
