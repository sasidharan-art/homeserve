(() => {
  const origin = window.location.origin;
  const endpoint = `${origin}/api/coupons/admin`;
  const token = localStorage.getItem("token");
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const authHeaders = json => ({ Authorization: `Bearer ${token}`, ...(json ? { "Content-Type": "application/json" } : {}) });
  const money = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;
  const message = (text, type="success") => typeof notify === "function" ? notify(text, type) : window.alert(text);

  async function call(url=endpoint, options={}) {
    const response = await fetch(url, { cache:"no-store", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Coupon operation failed.");
    return data;
  }

  async function loadCoupons() {
    const body = el("couponsBody"); if (!body) return;
    body.innerHTML = '<tr><td colspan="7" class="empty-cell">Loading coupons…</td></tr>';
    try {
      const coupons = await call(endpoint, { headers: authHeaders() });
      if (!coupons.length) return body.innerHTML = '<tr><td colspan="7" class="empty-cell">No coupons created yet.</td></tr>';
      body.innerHTML = coupons.map(c => `<tr><td><strong>${esc(c.code)}</strong><small>${esc(c.description || "No description")}</small></td><td>${c.discountType === "percentage" ? `${c.discountValue}%` : money(c.discountValue)}${c.maximumDiscount ? `<small>Cap ${money(c.maximumDiscount)}</small>` : ""}</td><td>${money(c.minimumAmount)}</td><td>${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : " / ∞"}</td><td>${new Date(c.expiresAt).toLocaleDateString("en-IN")}</td><td><span class="status-badge ${c.active ? "completed" : "cancelled"}">${c.active ? "Active" : "Inactive"}</span></td><td><div class="table-actions"><button data-toggle="${c._id}" data-active="${c.active}">${c.active ? "Disable" : "Enable"}</button><button class="danger" data-delete="${c._id}">Delete</button></div></td></tr>`).join("");
      body.querySelectorAll("[data-toggle]").forEach(btn => btn.onclick = async () => { try { await call(`${endpoint}/${btn.dataset.toggle}`, { method:"PATCH", headers:authHeaders(true), body:JSON.stringify({ active: btn.dataset.active !== "true" }) }); message("Coupon status updated."); loadCoupons(); } catch(e){ message(e.message,"error"); } });
      body.querySelectorAll("[data-delete]").forEach(btn => btn.onclick = async () => { if (!confirm("Delete this coupon permanently?")) return; try { await call(`${endpoint}/${btn.dataset.delete}`, { method:"DELETE", headers:authHeaders() }); message("Coupon deleted."); loadCoupons(); } catch(e){ message(e.message,"error"); } });
    } catch (e) { body.innerHTML = `<tr><td colspan="7" class="empty-cell">${esc(e.message)}</td></tr>`; }
  }

  el("couponForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const expiry = el("couponExpiry").value;
    const payload = { code:el("couponAdminCode").value, description:el("couponDescription").value, discountType:el("couponType").value, discountValue:Number(el("couponValue").value), minimumAmount:Number(el("couponMinimum").value||0), maximumDiscount:Number(el("couponMaximum").value||0), usageLimit:Number(el("couponLimit").value||0), expiresAt:new Date(`${expiry}T23:59:59`).toISOString(), active:true };
    try { await call(endpoint, { method:"POST", headers:authHeaders(true), body:JSON.stringify(payload) }); event.target.reset(); el("couponMinimum").value=0; el("couponMaximum").value=0; el("couponLimit").value=0; message("Coupon created successfully."); loadCoupons(); } catch(e){ message(e.message,"error"); }
  });
  el("refreshCoupons")?.addEventListener("click", loadCoupons);
  loadCoupons();
})();
