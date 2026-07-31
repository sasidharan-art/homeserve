const API = `${window.location.origin}/api/bookings`;
const token = localStorage.getItem("token");
const paper = document.getElementById("invoicePaper");
const bookingId = new URLSearchParams(window.location.search).get("id");

const esc = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const money = value => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = value => value ? new Intl.DateTimeFormat("en-IN", { day:"2-digit", month:"short", year:"numeric" }).format(new Date(value)) : "-";

if (!token) window.location.href = "login.html";
if (!bookingId) showError("Invoice booking ID is missing.");

document.getElementById("printInvoice")?.addEventListener("click", () => window.print());

function showError(message) {
  paper.innerHTML = `<div class="invoice-error"><h2>Invoice unavailable</h2><p>${esc(message)}</p><a class="btn btn-primary no-print" href="my-bookings.html">Return to bookings</a></div>`;
}

function renderInvoice(b) {
  const p = b.pricing || {};
  const isPaid = b.payment?.status === "Paid";
  const invoiceNumber = `INV-${String(b.bookingCode || b._id).replace(/[^A-Za-z0-9]/g, "")}`;
  paper.innerHTML = `
    <header class="invoice-head">
      <div class="invoice-brand"><span class="brand-mark">H</span><div><h1>HomeServe</h1><p>Trusted home services</p></div></div>
      <div class="invoice-title"><span class="invoice-payment-stamp ${isPaid ? "paid" : "unpaid"}">${isPaid ? "PAID" : esc(b.payment?.status || "UNPAID")}</span><h2>Tax Invoice</h2><p>${esc(invoiceNumber)}</p></div>
    </header>
    <div class="invoice-divider"></div>
    <section class="invoice-meta-grid">
      <div><small>Billed to</small><strong>${esc(b.customer?.name || "Customer")}</strong><span>${esc(b.customer?.email || "")}</span><span>${esc(b.customer?.phone || "")}</span><span>${esc(b.address || "")}</span></div>
      <div><small>Service professional</small><strong>${esc(b.provider?.name || "Not assigned")}</strong><span>${esc(b.provider?.phone || "")}</span></div>
      <div><small>Invoice details</small><span><b>Booking:</b> ${esc(b.bookingCode || b._id)}</span><span><b>Booking date:</b> ${dateText(b.bookingDate)}</span><span><b>Time:</b> ${esc(b.timeSlot || "-")}</span><span><b>Issued:</b> ${dateText(new Date())}</span></div>
    </section>
    <section class="invoice-service-table">
      <div class="invoice-row invoice-table-head"><span>Description</span><span>Amount</span></div>
      <div class="invoice-row"><span><strong>${esc(b.service?.name || "Home service")}</strong><small>${esc(b.service?.category || "Professional service")}</small></span><span>${money(p.base || b.service?.price)}</span></div>
      <div class="invoice-row"><span>Visit charge</span><span>${money(p.visit)}</span></div>
      ${Number(p.emergency || 0) > 0 ? `<div class="invoice-row"><span>Emergency priority charge</span><span>${money(p.emergency)}</span></div>` : ""}
      <div class="invoice-row"><span>GST / tax</span><span>${money(p.tax)}</span></div>
      ${Number(p.discount || 0) > 0 ? `<div class="invoice-row invoice-discount"><span>Coupon ${escapeHtml(p.couponCode || "discount")}</span><span>−${money(p.discount)}</span></div>` : ""}
      <div class="invoice-row invoice-total"><span>Total</span><span>${money(p.total || b.service?.price)}</span></div>
    </section>
    <section class="invoice-payment-info">
      <div><small>Payment method</small><strong>${esc(b.payment?.method || "Not selected")}</strong></div>
      <div><small>Payment status</small><strong>${esc(b.payment?.status || "Unpaid")}</strong></div>
      <div><small>Transaction reference</small><strong>${esc(b.payment?.transactionRef || "-")}</strong></div>
      <div><small>Paid on</small><strong>${b.payment?.paidAt ? dateText(b.payment.paidAt) : "-"}</strong></div>
    </section>
    <footer class="invoice-footer">
      <p>Thank you for choosing HomeServe.</p>
      <small>This computer-generated invoice does not require a signature. Keep the booking reference for support requests.</small>
    </footer>`;
}

async function loadInvoice() {
  if (!bookingId) return;
  try {
    const response = await fetch(`${API}/${encodeURIComponent(bookingId)}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Unable to load invoice.");
    if (data.status !== "Completed") throw new Error("The invoice becomes available after the service is completed.");
    renderInvoice(data);
  } catch (error) { showError(error.message); }
}
loadInvoice();
