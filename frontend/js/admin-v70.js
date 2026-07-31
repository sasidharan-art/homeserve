const API_ORIGIN = window.location.origin;
const API = `${API_ORIGIN}/api/admin`;
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
const storedName = localStorage.getItem("name") || "Administrator";
let allBookings = [];
let allUsers = [];
let providers = [];

if (!token || role !== "admin") window.location.replace("login.html");

const $ = (id) => document.getElementById(id);
const headers = (json = false) => ({ Authorization: `Bearer ${token}`, Accept: "application/json", ...(json ? { "Content-Type": "application/json" } : {}) });
const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const formatDate = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const shortId = (id = "") => `#${id.slice(-6).toUpperCase()}`;
const money = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

$("adminName").textContent = `Welcome back, ${storedName.split(" ")[0]}`;
$("sidebarAdminName").textContent = storedName;
const handleAdminLogout = () => { localStorage.clear(); location.href = "login.html"; };
$("logoutBtn").onclick = handleAdminLogout;
if ($("logoutTopBtn")) $("logoutTopBtn").onclick = handleAdminLogout;

function notify(message, type = "success") {
  const box = $("adminAlert");
  box.textContent = message;
  box.className = `admin-alert ${type}`;
  box.hidden = false;
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => box.hidden = true, 3500);
}

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch (error) {
    throw new Error("Cannot connect to the backend. Start the server on port 5000 and refresh this page.");
  }
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { message: text || "Unexpected server response." }; }

  if (response.status === 401) {
    ["token", "role", "name"].forEach(key => localStorage.removeItem(key));
    sessionStorage.setItem("authNotice", data.message || "Your session expired. Please log in again.");
    location.replace("login.html");
    throw new Error(data.message || "Session expired.");
  }
  if (response.status === 403) {
    throw new Error("This account does not have administrator access.");
  }
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status}).`);
  return data;
}

function statusBadge(status) {
  return `<span class="status-badge ${status.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(status)}</span>`;
}

function switchSection(name) {
  document.querySelectorAll(".admin-section").forEach(s => s.classList.toggle("active", s.id === `section-${name}`));
  document.querySelectorAll(".admin-nav-link[data-section]").forEach(b => b.classList.toggle("active", b.dataset.section === name));
  document.body.classList.remove("admin-menu-open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-section]").forEach(el => el.addEventListener("click", () => switchSection(el.dataset.section)));
document.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", () => switchSection(el.dataset.go)));
$("adminMenuBtn").onclick = () => document.body.classList.toggle("admin-menu-open");
$("adminOverlay").onclick = () => document.body.classList.remove("admin-menu-open");

async function loadDashboard() {
  try {
    const data = await request(`${API}/dashboard`, { headers: headers() });
    ["customers","providers","bookings","pending","accepted","onTheWay","completed","cancelled"].forEach(id => $(id).textContent = data[id] || 0);
    $("revenue").textContent = money(data.revenue);
    $("pendingBadge").textContent = data.pending || 0;
    $("completionRate").textContent = `${data.bookings ? Math.round((data.completed / data.bookings) * 100) : 0}%`;
    renderRecent(data.recentBookings || []);
    renderPopular(data.popularServices || []);
  } catch (error) { notify(error.message, "error"); }
}

function renderRecent(items) {
  $("recentBookingsBody").innerHTML = items.length ? items.map(b => `<tr><td><strong>${shortId(b._id)}</strong></td><td>${escapeHtml(b.customer?.name || "Unknown")}</td><td>${escapeHtml(b.service?.name || "Removed service")}</td><td>${formatDate(b.bookingDate)}</td><td>${money(b.pricing?.total || b.service?.price)}</td><td>${statusBadge(b.status)}</td></tr>`).join("") : `<tr><td colspan="6" class="empty-cell">No bookings yet.</td></tr>`;
}

function renderPopular(items) {
  const max = Math.max(...items.map(i => i.count), 1);
  $("popularServices").innerHTML = items.length ? items.map((item, index) => `<div class="popularity-item"><div><span>${index + 1}</span><strong>${escapeHtml(item.name)}</strong><b>${item.count} bookings</b></div><div class="progress-track"><i style="width:${(item.count / max) * 100}%"></i></div></div>`).join("") : `<p class="empty-state">Bookings will appear here as customers use services.</p>`;
}

async function loadBookings() {
  try {
    const result = await request(`${API}/bookings`, { headers: headers() });
    allBookings = Array.isArray(result) ? result : [];
    renderBookings();
  } catch (error) { notify(error.message, "error"); }
}

function renderBookings() {
  const q = $("bookingSearch").value.trim().toLowerCase();
  const status = $("bookingStatusFilter").value;
  const rows = allBookings.filter(b => {
    const haystack = `${b._id} ${b.customer?.name || ""} ${b.customer?.email || ""} ${b.service?.name || ""}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!status || b.status === status);
  });
  $("bookingsBody").innerHTML = rows.length ? rows.map(b => `<tr>
    <td><strong>${shortId(b._id)}</strong><small>${money(b.pricing?.total || b.service?.price)}</small></td>
    <td><strong>${escapeHtml(b.customer?.name || "Unknown")}</strong><small>${escapeHtml(b.customer?.phone || b.customer?.email || "")}</small></td>
    <td>${escapeHtml(b.service?.name || "Removed service")}</td>
    <td><select class="table-select" onchange="assignProvider('${b._id}', this.value)"><option value="">Unassigned</option>${providers.map(p => `<option value="${p._id}" ${b.provider?._id === p._id ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}</select></td>
    <td>${formatDate(b.bookingDate)}<small>${escapeHtml(b.address || "No address")}</small>${b.customerLocation?.latitude != null && b.customerLocation?.longitude != null ? `<button class="text-button" onclick="openCustomerMap(${Number(b.customerLocation.latitude)}, ${Number(b.customerLocation.longitude)})">Open map</button>` : ""}</td>
    <td>${statusBadge(b.status)}<small>${escapeHtml(b.payment?.status || "Unpaid")}</small></td>
    <td><select class="table-select" onchange="updateBookingStatus('${b._id}', this.value)">${["Pending","Accepted","On the Way","Completed","Cancelled"].map(s => `<option ${s === b.status ? "selected" : ""}>${s}</option>`).join("")}</select><button class="text-button" onclick="togglePayment('${b._id}','Paid')">Verify paid</button>${b.payment?.status==='Pending Verification'?`<button class="text-button" onclick="togglePayment('${b._id}','Rejected')">Reject</button>`:''}</td>
  </tr>`).join("") : `<tr><td colspan="7" class="empty-cell">No bookings match your filters.</td></tr>`;
}

async function updateBookingStatus(id, status) {
  try {
    await request(`${API}/bookings/${id}`, { method: "PATCH", headers: headers(true), body: JSON.stringify({ status }) });
    notify("Booking status updated");
    await Promise.all([loadBookings(), loadDashboard()]);
  } catch (error) { notify(error.message, "error"); }
}

async function assignProvider(id, provider) {
  try {
    await request(`${API}/bookings/${id}`, { method: "PATCH", headers: headers(true), body: JSON.stringify({ provider }) });
    notify(provider ? "Provider assigned" : "Provider removed");
    await loadBookings();
  } catch (error) { notify(error.message, "error"); }
}

async function loadUsers() {
  try {
    const result = await request(`${API}/users`, { headers: headers() });
    allUsers = Array.isArray(result) ? result : [];
    providers = allUsers.filter(u => u.role === "provider" && u.isActive !== false);
    renderUsers();
    renderBookings();
  } catch (error) { notify(error.message, "error"); }
}

function renderUsers() {
  const q = $("userSearch").value.trim().toLowerCase();
  const roleFilter = $("userRoleFilter").value;
  const users = allUsers.filter(u => u.role !== "admin" && (!roleFilter || u.role === roleFilter) && (!q || `${u.name} ${u.email} ${u.phone}`.toLowerCase().includes(q)));
  $("usersBody").innerHTML = users.length ? users.map(u => `<tr>
    <td><div class="user-cell"><span>${escapeHtml((u.name || "U").charAt(0).toUpperCase())}</span><div><strong>${escapeHtml(u.name)}</strong><small>${shortId(u._id)}</small></div></div></td>
    <td><strong>${escapeHtml(u.email)}</strong><small>${escapeHtml(u.phone || "")}</small></td>
    <td><span class="role-pill ${u.role}">${escapeHtml(u.role)}</span></td>
    <td>${formatDate(u.createdAt)}</td>
    <td>${u.isActive === false ? '<span class="access off">Suspended</span>' : '<span class="access on">Active</span>'}</td>
    <td><div class="row-actions"><button onclick="toggleUser('${u._id}', ${u.isActive === false})">${u.isActive === false ? "Activate" : "Suspend"}</button><button class="danger" onclick="deleteUser('${u._id}', '${escapeHtml(u.name)}')">Delete</button></div></td>
  </tr>`).join("") : `<tr><td colspan="6" class="empty-cell">No users match your filters.</td></tr>`;
}

async function toggleUser(id, activate) {
  try {
    await request(`${API}/users/${id}/status`, { method: "PATCH", headers: headers(true), body: JSON.stringify({ isActive: activate }) });
    notify(activate ? "User activated" : "User suspended");
    await loadUsers();
  } catch (error) { notify(error.message, "error"); }
}

async function deleteUser(id, name) {
  if (!confirm(`Delete ${name} and related bookings? This cannot be undone.`)) return;
  try {
    await request(`${API}/users/${id}`, { method: "DELETE", headers: headers() });
    notify("User deleted");
    await Promise.all([loadUsers(), loadBookings(), loadDashboard()]);
  } catch (error) { notify(error.message, "error"); }
}

$("bookingSearch").addEventListener("input", renderBookings);
$("bookingStatusFilter").addEventListener("change", renderBookings);
$("userSearch").addEventListener("input", renderUsers);
$("userRoleFilter").addEventListener("change", renderUsers);



let adminCustomQrImage = "";

function renderAdminQrPreview() {
  const preview = $("adminQrPreview");
  preview.innerHTML = "";
  const upi = $("paymentUpiId").value.trim();
  const enabled = $("paymentQrEnabled").checked;
  if (!enabled) {
    $("adminQrPreviewText").textContent = "QR payments are disabled. Workers and customers will not see any QR.";
    return;
  }
  if (adminCustomQrImage) {
    const img = document.createElement("img");
    img.src = adminCustomQrImage;
    img.alt = "Admin payment QR";
    preview.appendChild(img);
    $("adminQrPreviewText").textContent = "Uploaded QR is enabled for all workers and customers.";
    return;
  }
  if (!upi) { $("adminQrPreviewText").textContent = "Enter a UPI ID or upload a QR image before enabling."; return; }
  const previewAmount = $("qrAmountMode").value === "fixed" ? Math.max(1, Number($("fixedQrAmount").value || 1)) : 1;
  const uri = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${encodeURIComponent($("paymentPayeeName").value.trim() || "HomeServe")}&am=${previewAmount.toFixed(2)}&cu=INR&tn=${encodeURIComponent($("paymentNote").value.trim() || "Home service payment")}`;
  new QRCode(preview, { text: uri, width: 210, height: 210, correctLevel: QRCode.CorrectLevel.M });
  $("adminQrPreviewText").textContent = `Generated QR is enabled for all workers · ${upi}`;
}

async function loadPaymentSettings() {
  try {
    const settings = await request(`${API}/payment-settings`, { headers: headers() });
    $("paymentQrEnabled").checked = Boolean(settings.paymentQrEnabled);
    $("allowProviderSelfAccept").checked = Boolean(settings.allowProviderSelfAccept);
    $("paymentUpiId").value = settings.upiId || "";
    adminCustomQrImage = settings.customQrImage || "";
    $("paymentPayeeName").value = settings.payeeName || "HomeServe";
    $("paymentNote").value = settings.paymentNote || "Home service payment";
    $("cashOnDeliveryEnabled").checked = settings.cashOnDeliveryEnabled !== false;
    $("qrAmountMode").value = settings.qrAmountMode || "booking";
    $("fixedQrAmount").value = settings.fixedQrAmount || 1;
    renderAdminQrPreview();
  } catch (error) { notify(error.message, "error"); }
}

$("paymentSettingsForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const data = await request(`${API}/payment-settings`, {
      method: "PUT", headers: headers(true), body: JSON.stringify({
        paymentQrEnabled: $("paymentQrEnabled").checked,
        upiId: $("paymentUpiId").value.trim(),
        customQrImage: adminCustomQrImage,
        payeeName: $("paymentPayeeName").value.trim(),
        paymentNote: $("paymentNote").value.trim(),
        cashOnDeliveryEnabled: $("cashOnDeliveryEnabled").checked,
        qrAmountMode: $("qrAmountMode").value,
        fixedQrAmount: Number($("fixedQrAmount").value || 1),
        allowProviderSelfAccept: $("allowProviderSelfAccept").checked
      })
    });
    notify(data.message);
    renderAdminQrPreview();
  } catch (error) { notify(error.message, "error"); }
});
["paymentQrEnabled","cashOnDeliveryEnabled","allowProviderSelfAccept","paymentUpiId","paymentPayeeName","paymentNote","qrAmountMode","fixedQrAmount"].forEach(id => $(id).addEventListener("input", renderAdminQrPreview));

$("paymentQrImage").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!/^image\/(png|jpeg|webp)$/i.test(file.type)) return notify("Choose a PNG, JPG or WebP image.", "error");
  if (file.size > 1024 * 1024) { event.target.value = ""; return notify("QR image must be below 1 MB.", "error"); }
  const reader = new FileReader();
  reader.onload = () => { adminCustomQrImage = String(reader.result || ""); renderAdminQrPreview(); notify("QR image selected. Click Save QR controls."); };
  reader.readAsDataURL(file);
});

$("removePaymentQrImage").addEventListener("click", () => {
  adminCustomQrImage = "";
  $("paymentQrImage").value = "";
  renderAdminQrPreview();
  notify("Uploaded QR removed. Click Save QR controls to apply.");
});

async function togglePayment(id, status) {
  try {
    const data = await request(`${API}/bookings/${id}/payment`, { method:"PATCH", headers:headers(true), body:JSON.stringify({ status }) });
    notify(data.message);
    await loadBookings();
  } catch (error) { notify(error.message, "error"); }
}



$("openWorkerForm").addEventListener("click", () => { $("workerCreateCard").hidden = false; $("workerName").focus(); });
$("closeWorkerForm").addEventListener("click", () => { $("workerCreateCard").hidden = true; });
$("workerForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  button.textContent = "Creating…";
  try {
    const data = await request(`${API}/providers`, { method:"POST", headers:headers(true), body:JSON.stringify({
      name:$("workerName").value.trim(), email:$("workerEmail").value.trim(), phone:$("workerPhone").value.trim(),
      password:$("workerPassword").value, skills:$("workerSkills").value.split(",").map(v => v.trim()).filter(Boolean),
      experienceYears:Number($("workerExperience").value || 0)
    }) });
    notify(data.message);
    event.target.reset();
    $("workerCreateCard").hidden = true;
    await loadUsers();
  } catch (error) { notify(error.message, "error"); }
  finally { button.disabled = false; button.textContent = "Create provider login"; }
});

async function bootstrapAdmin() {
  $("recentBookingsBody").innerHTML = `<tr><td colspan="6" class="empty-cell">Loading recent bookings…</td></tr>`;
  $("bookingsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">Loading bookings…</td></tr>`;
  $("usersBody").innerHTML = `<tr><td colspan="6" class="empty-cell">Loading users and workers…</td></tr>`;
  try {
    // Users must load first so the worker assignment dropdown is populated correctly.
    await loadUsers();
    await Promise.all([loadDashboard(), loadBookings(), loadPaymentSettings(), loadSystemHealth()]);
  } catch (error) {
    notify(error.message || "Admin data could not be loaded.", "error");
  }
}
bootstrapAdmin();

window.openCustomerMap = function(latitude, longitude) {
  if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) return notify("Customer location is unavailable", "error");
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(latitude + "," + longitude)}`, "_blank", "noopener");
};

function renderPaymentReview() {
  const body = $("paymentsReviewBody");
  if (!body) return;
  const items = allBookings.filter(b => b.status === "Completed" || ["Pending Verification", "Paid", "Rejected"].includes(b.payment?.status));
  body.innerHTML = items.length ? items.map(b => {
    const paymentStatus = b.payment?.status || "Unpaid";
    const method = b.payment?.method || "UPI QR";
    const ref = b.payment?.transactionRef || (method === "Cash on Delivery" ? "Worker collection" : "—");
    const actions = paymentStatus === "Pending Verification"
      ? `<button class="text-button" onclick="togglePayment('${b._id}','Paid')">Verify</button><button class="text-button danger-text" onclick="togglePayment('${b._id}','Rejected')">Reject</button>`
      : paymentStatus === "Paid"
        ? `<button class="text-button" onclick="togglePayment('${b._id}','Unpaid')">Mark unpaid</button>`
        : `<button class="text-button" onclick="togglePayment('${b._id}','Paid')">Mark paid</button>`;
    return `<tr><td><strong>${escapeHtml(b.bookingCode || shortId(b._id))}</strong></td><td><strong>${escapeHtml(b.customer?.name || "Unknown")}</strong><small>${escapeHtml(b.customer?.phone || b.customer?.email || "")}</small></td><td>${escapeHtml(method)}</td><td>${money(b.pricing?.total || b.service?.price)}</td><td>${escapeHtml(ref)}</td><td><span class="status-badge ${paymentStatus.toLowerCase().replaceAll(" ", "-")}">${escapeHtml(paymentStatus)}</span></td><td>${actions}</td></tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-cell">No completed or payment-review bookings yet.</td></tr>`;
}

$("refreshPayments")?.addEventListener("click", async () => { await loadBookings(); notify("Payment activity refreshed"); });

const originalRenderBookings = renderBookings;
renderBookings = function() {
  originalRenderBookings();
  renderPaymentReview();
};

async function loadSystemHealth() {
  const set = (id, text) => { const el = $(id); if (el) el.textContent = text; };
  try {
    const data = await request(`${API}/system-health`, { headers: headers() });
    set("healthApi", data.api?.ok ? "Online" : "Unavailable");
    set("healthUptime", `Uptime ${data.api?.uptimeHuman || "—"}`);
    set("healthDatabase", data.database?.state || "Unknown");
    set("healthSocket", data.realtime?.socketIo ? "Ready" : "Unavailable");
    set("healthPayments", data.payments?.configured ? "Configured" : "Needs setup");
    set("healthPaymentDetail", data.payments?.summary || "Review payment settings");
    set("healthCheckedAt", `Checked ${new Date(data.checkedAt).toLocaleTimeString("en-IN")}`);
    const checks = Array.isArray(data.checks) ? data.checks : [];
    $("readinessList").innerHTML = checks.map(item => `<div><span><i class="dot ${item.ok ? "completed" : "pending"}"></i>${escapeHtml(item.label)}</span><strong>${item.ok ? "Ready" : escapeHtml(item.detail || "Action needed")}</strong></div>`).join("") || `<div><span>No checks returned</span><strong>—</strong></div>`;
  } catch (error) {
    ["healthApi","healthDatabase","healthSocket","healthPayments"].forEach(id => set(id, "Unavailable"));
    $("readinessList").innerHTML = `<div><span>Backend health check</span><strong>${escapeHtml(error.message)}</strong></div>`;
  }
}
$("refreshSystemHealth")?.addEventListener("click", loadSystemHealth);
document.querySelector('[data-section="system"]')?.addEventListener("click", loadSystemHealth);


// Phase 7.0 analytics
let analyticsSnapshot = null;

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(320, canvas.clientWidth || canvas.parentElement.clientWidth || 600);
  const height = Number(canvas.getAttribute("height") || 240);
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const context = canvas.getContext("2d");
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { context, width, height };
}

function drawBarChart(canvasId, labels, values, valueFormatter = value => String(value)) {
  const canvas = $(canvasId); if (!canvas) return;
  const { context: ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const padding = { left: 52, right: 18, top: 18, bottom: 38 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const max = Math.max(...values, 1);
  ctx.strokeStyle = "#dbe7f5"; ctx.lineWidth = 1;
  ctx.fillStyle = "#718097"; ctx.font = "12px Arial";
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * i / 4);
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
    const value = max - (max * i / 4);
    ctx.fillText(valueFormatter(value), 4, y + 4);
  }
  const slot = chartWidth / Math.max(labels.length, 1);
  values.forEach((value, index) => {
    const barWidth = Math.min(48, slot * .58);
    const x = padding.left + index * slot + (slot - barWidth) / 2;
    const barHeight = chartHeight * value / max;
    const y = padding.top + chartHeight - barHeight;
    const gradient = ctx.createLinearGradient(0, y, 0, padding.top + chartHeight);
    gradient.addColorStop(0, "#2563eb"); gradient.addColorStop(1, "#10b8b0");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    const radius = Math.min(10, barWidth / 3);
    ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 2, 2]); ctx.fill();
    ctx.fillStyle = "#41536d"; ctx.textAlign = "center";
    ctx.fillText(labels[index] || "", x + barWidth / 2, height - 14);
  });
  ctx.textAlign = "start";
}

function drawDonutChart(canvasId, labels, values) {
  const canvas = $(canvasId); if (!canvas) return;
  const { context: ctx, width, height } = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  const colors = ["#f59e0b", "#2563eb", "#06b6d4", "#10b981", "#ef4444", "#8b5cf6"];
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const centerX = Math.min(width * .35, 190), centerY = height / 2, radius = Math.min(78, height * .34);
  let start = -Math.PI / 2;
  values.forEach((value, index) => {
    const angle = value / total * Math.PI * 2;
    ctx.beginPath(); ctx.arc(centerX, centerY, radius, start, start + angle); ctx.strokeStyle = colors[index % colors.length]; ctx.lineWidth = 30; ctx.stroke(); start += angle;
  });
  ctx.fillStyle = "#10233f"; ctx.textAlign = "center"; ctx.font = "700 24px Arial"; ctx.fillText(String(total === 1 && values.every(v => v === 0) ? 0 : total), centerX, centerY + 3);
  ctx.font = "12px Arial"; ctx.fillStyle = "#718097"; ctx.fillText("bookings", centerX, centerY + 23);
  ctx.textAlign = "start"; ctx.font = "12px Arial";
  labels.forEach((label, index) => {
    const x = Math.max(width * .58, 230), y = 34 + index * 34;
    ctx.fillStyle = colors[index % colors.length]; ctx.fillRect(x, y - 9, 12, 12);
    ctx.fillStyle = "#41536d"; ctx.fillText(`${label}: ${values[index]}`, x + 20, y + 1);
  });
}

function renderAnalytics(data) {
  analyticsSnapshot = data;
  const months = Array.isArray(data.months) ? data.months : [];
  const latest = months.at(-1) || {};
  $("analyticsPaidRevenue").textContent = money(data.paidRevenue);
  $("analyticsPaidBookings").textContent = `${data.paidBookings || 0} paid bookings`;
  $("analyticsMonthRevenue").textContent = money(latest.revenue);
  $("analyticsMonthBookings").textContent = `${latest.completedBookings || 0} completed jobs`;
  $("analyticsNewCustomers").textContent = latest.newCustomers || 0;
  const topWorker = data.workers?.[0];
  $("analyticsTopWorker").textContent = topWorker?.name || "—";
  $("analyticsTopWorkerJobs").textContent = topWorker ? `${topWorker.completedJobs} completed · ${Math.round(topWorker.completionRate)}% rate` : "No completed jobs yet";
  drawBarChart("revenueChart", months.map(item => item.label), months.map(item => item.revenue), value => value >= 1000 ? `₹${Math.round(value / 1000)}k` : `₹${Math.round(value)}`);
  drawBarChart("customerChart", months.map(item => item.label), months.map(item => item.newCustomers), value => String(Math.round(value)));
  const statuses = Array.isArray(data.statuses) ? data.statuses : [];
  drawDonutChart("statusChart", statuses.map(item => item.status), statuses.map(item => item.count));
  const payments = Array.isArray(data.payments) ? data.payments : [];
  $("paymentAnalytics").innerHTML = payments.length ? payments.map(item => `<div><span><strong>${escapeHtml(item.method)}</strong><small>${escapeHtml(item.status)}</small></span><b>${item.count}</b><em>${money(item.amount)}</em></div>`).join("") : `<p class="empty-state">No payment records yet.</p>`;
  const workers = Array.isArray(data.workers) ? data.workers : [];
  $("workerLeaderboard").innerHTML = workers.length ? workers.map((worker, index) => `<tr><td><span class="rank-badge">${index + 1}</span></td><td><strong>${escapeHtml(worker.name)}</strong><small>${worker.available === false ? "Unavailable" : "Available"}</small></td><td>${worker.totalJobs}</td><td>${worker.completedJobs}</td><td><div class="rate-cell"><span><i style="width:${Math.min(100, worker.completionRate)}%"></i></span><b>${Math.round(worker.completionRate)}%</b></div></td><td>${money(worker.earnings)}</td></tr>`).join("") : `<tr><td colspan="6" class="empty-cell">No assigned worker data yet.</td></tr>`;
}

async function loadAnalytics() {
  try {
    const data = await request(`${API}/analytics`, { headers: headers() });
    renderAnalytics(data);
  } catch (error) { notify(error.message, "error"); }
}

function exportAnalyticsCsv() {
  if (!analyticsSnapshot) return notify("Load analytics before exporting.", "error");
  const rows = [["Month","Completed bookings","Revenue","New customers"], ...analyticsSnapshot.months.map(item => [item.label,item.completedBookings,item.revenue,item.newCustomers]), [], ["Worker","Total jobs","Completed jobs","Completion rate","Completed value"], ...analyticsSnapshot.workers.map(item => [item.name,item.totalJobs,item.completedJobs,`${Math.round(item.completionRate)}%`,item.earnings])];
  const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"','""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `homeserve-analytics-${new Date().toISOString().slice(0,10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
}

$("refreshAnalytics")?.addEventListener("click", async () => { await loadAnalytics(); notify("Analytics refreshed"); });
$("exportAnalytics")?.addEventListener("click", exportAnalyticsCsv);
document.querySelector('[data-section="analytics"]')?.addEventListener("click", loadAnalytics);
window.addEventListener("resize", () => { if (document.getElementById("section-analytics")?.classList.contains("active") && analyticsSnapshot) renderAnalytics(analyticsSnapshot); });
