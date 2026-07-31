const API_ORIGIN = window.location.origin;
const API = `${API_ORIGIN}/api/provider`;
const token = localStorage.getItem("token");
const role = localStorage.getItem("role");
let allBookings = [];
const liveTrackers = new Map();
let providerAvailable = true;
let paymentSettings = { enabled:false, upiId:"", payeeName:"HomeServe", paymentNote:"Home service payment" };

if (!token) window.location.href = "login.html";
if (role && role !== "provider") window.location.href = "dashboard.html";

const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
const money = value => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));
const dateTime = value => new Date(value).toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
const shortTime = value => new Date(value).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });

function toast(message, error = false) {
  const el = $("providerToast");
  el.textContent = message;
  el.className = `provider-toast show${error ? " error" : ""}`;
  clearTimeout(window.providerToastTimer);
  window.providerToastTimer = setTimeout(() => el.className = "provider-toast", 3000);
}

async function request(path, options = {}) {
  let response;
  try { response = await fetch(API + path, {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  }); } catch (_) { throw new Error("Cannot connect to the backend. Start the server on port 5000."); }
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "login.html";
    throw new Error(data.message || "Your session has expired. Please log in again.");
  }
  if (!response.ok) throw new Error(data.message || "Request failed. Please try again.");
  return data;
}

function setAvailability(value) {
  providerAvailable = Boolean(value);
  $("availabilityBtn").classList.toggle("off", !providerAvailable);
  $("availabilityBtn").setAttribute("aria-pressed", String(providerAvailable));
  $("availabilityText").textContent = providerAvailable ? "Available" : "Offline";
}

function statusColor(status) {
  return ({ Pending:"#d97706", Accepted:"#2563eb", "On the Way":"#0891b2", Completed:"#059669", Cancelled:"#d62f45" })[status] || "#64748b";
}

function nextAction(booking) {
  if (booking.status === "Pending") return { label: "Accept request", status: "Accepted", cls: "" };
  if (booking.status === "Accepted") return { label: "Start journey", status: "On the Way", cls: "" };
  if (booking.status === "On the Way") return { label: "Mark completed", status: "Completed", cls: "complete" };
  return null;
}

function locationButton(b) {
  const loc = b.customerLocation;
  if (!loc || !Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) return "";
  return `<button type="button" data-location-id="${escapeHtml(b._id)}">⌖ Customer map</button>`;
}

function paymentButton(b) {
  if (!paymentSettings.enabled || !paymentSettings.upiId || b.status === "Pending" || b.status === "Cancelled") return "";
  return `<button type="button" data-payment-id="${escapeHtml(b._id)}">▦ Payment QR</button>`;
}

function trackingButton(b) {
  if (!["Accepted", "On the Way"].includes(b.status)) return "";
  const active = liveTrackers.has(b._id);
  return `<button type="button" class="${active ? "tracking-active" : ""}" data-track-id="${escapeHtml(b._id)}">${active ? "● Stop live location" : "◎ Share live location"}</button>`;
}

function bookingCard(b) {
  const action = nextAction(b);
  const service = b.service || {};
  const customer = b.customer || {};
  const initial = (customer.name || "C").trim().charAt(0).toUpperCase();
  return `<article class="provider-job-card" style="--status-color:${statusColor(b.status)}">
    <div class="job-top"><span class="job-code">${escapeHtml(b.bookingCode || `JOB-${String(b._id).slice(-6).toUpperCase()}`)}</span><span class="job-status">${escapeHtml(b.status)}</span></div>
    <h3>${escapeHtml(service.name || "Home service")}</h3><span class="job-category">${escapeHtml(service.category || "General service")}</span>
    <div class="job-details"><p><span>◷</span><span>${escapeHtml(dateTime(b.bookingDate))}${b.timeSlot ? ` · ${escapeHtml(b.timeSlot)}` : ""}</span></p><p><span>⌂</span><span>${escapeHtml(b.address || "Address unavailable")}</span></p><p><span>₹</span><span>${escapeHtml(money(b.pricing?.total || service.price))}${b.emergency ? " · Emergency" : ""}</span></p></div>
    <div class="job-customer"><span class="customer-avatar">${escapeHtml(initial)}</span><div><strong>${escapeHtml(customer.name || "Customer")}</strong><span>${escapeHtml(customer.phone || customer.email || "Contact unavailable")}</span></div></div>
    ${action ? `<button class="job-action ${action.cls}" data-booking-id="${escapeHtml(b._id)}" data-next-status="${action.status}">${action.label}</button>` : `<button class="job-action" disabled>${b.status === "Completed" ? "Job completed" : "No action available"}</button>`}
    <div class="job-secondary-actions">${locationButton(b)}${trackingButton(b)}${paymentButton(b)}</div>
    <span class="job-payment-badge ${b.payment?.status === "Paid" ? "paid" : ""}">${escapeHtml(b.payment?.status || "Unpaid")}</span>
  </article>`;
}

function renderBookings() {
  const query = $("jobSearch").value.trim().toLowerCase();
  const filter = $("statusFilter").value;
  const visible = allBookings.filter(b => {
    const haystack = [b.service?.name, b.service?.category, b.customer?.name, b.customer?.phone, b.address, b.bookingCode].join(" ").toLowerCase();
    return (!query || haystack.includes(query)) && (filter === "all" || b.status === filter);
  });
  $("bookingList").innerHTML = visible.length ? visible.map(bookingCard).join("") : `<div class="empty-provider" style="grid-column:1/-1"><strong>No matching jobs</strong><br>Try another search or status filter.</div>`;
}

function renderSchedule(jobs) {
  $("todayCount").textContent = jobs.length;
  $("todaySchedule").innerHTML = jobs.length ? jobs.map(b => `<article class="schedule-item"><span class="schedule-time">${escapeHtml(b.timeSlot || shortTime(b.bookingDate))}</span><div><h3>${escapeHtml(b.service?.name || "Service")}</h3><p>${escapeHtml(b.customer?.name || "Customer")} · ${escapeHtml(b.address || "")}</p></div><span class="mini-status">${escapeHtml(b.status)}</span></article>`).join("") : `<div class="empty-provider">No active jobs scheduled for today.</div>`;
}

function renderChart(monthly) {
  const max = Math.max(1, ...monthly.map(item => item.earnings));
  $("earningsChart").innerHTML = monthly.map(item => {
    const height = Math.max(4, Math.round(item.earnings / max * 155));
    return `<div class="chart-column"><span class="chart-value">${item.earnings ? escapeHtml(money(item.earnings)) : "₹0"}</span><span class="chart-bar" style="height:${height}px" title="${escapeHtml(item.jobs)} completed jobs"></span><small>${escapeHtml(item.label)}</small></div>`;
  }).join("");
}

async function loadDashboard(showMessage = false) {
  try {
    const [dashboard, bookings, payments] = await Promise.all([request("/dashboard"), request("/bookings"), request("/payment-settings")]);
    paymentSettings = payments;
    allBookings = bookings;
    const firstName = dashboard.profile.name?.split(" ")[0] || "Provider";
    $("providerName").textContent = `Welcome back, ${firstName}`;
    const skills = dashboard.profile.skills?.length ? dashboard.profile.skills.join(" · ") : "General home services";
    const exp = Number(dashboard.profile.experienceYears || 0);
    const profileLine = $("workerProfileLine");
    if (profileLine) profileLine.textContent = `${skills} · ${exp} year${exp === 1 ? "" : "s"} experience`;
    setAvailability(dashboard.profile.available);
    $("openCount").textContent = dashboard.stats.openRequests;
    $("activeCount").textContent = dashboard.stats.accepted + dashboard.stats.onTheWay;
    $("completedCount").textContent = dashboard.stats.completed;
    $("earningsCount").textContent = money(dashboard.stats.earnings);
    const assignedTotal = dashboard.stats.accepted + dashboard.stats.onTheWay + dashboard.stats.completed;
    const performance = assignedTotal ? Math.round(dashboard.stats.completed / assignedTotal * 100) : 0;
    $("performanceValue").textContent = `${performance}%`;
    document.querySelector(".performance-ring").style.setProperty("--ring", `${performance}%`);
    renderSchedule(dashboard.todayJobs || []);
    renderChart(dashboard.monthly || []);
    renderBookings();
    if (showMessage) toast("Dashboard refreshed.");
  } catch (err) {
    $("bookingList").innerHTML = `<div class="empty-provider" style="grid-column:1/-1"><strong>Unable to load provider data</strong><br>${escapeHtml(err.message)}</div>`;
    toast(err.message, true);
  }
}

$("bookingList").addEventListener("click", async event => {
  const locationBtn = event.target.closest("[data-location-id]");
  if (locationBtn) {
    const booking = allBookings.find(item => item._id === locationBtn.dataset.locationId);
    const loc = booking?.customerLocation;
    if (!loc) return toast("Customer location becomes available after accepting the request.", true);
    const lat = Number(loc.latitude), lng = Number(loc.longitude);
    $("locationModalTitle").textContent = `${booking.customer?.name || "Customer"} · ${booking.service?.name || "Service"}`;
    $("customerMapFrame").src = `https://www.openstreetmap.org/export/embed.html?bbox=${lng-.008}%2C${lat-.006}%2C${lng+.008}%2C${lat+.006}&layer=mapnik&marker=${lat}%2C${lng}`;
    $("openMapsLink").href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    $("locationAccuracy").textContent = loc.accuracy ? `Customer GPS location accuracy is approximately ${Math.round(loc.accuracy)} m accuracy.` : "Customer-shared booking location.";
    $("locationModal").hidden = false;
    return;
  }
  const trackBtn = event.target.closest("[data-track-id]");
  if (trackBtn) {
    const id = trackBtn.dataset.trackId;
    if (liveTrackers.has(id)) {
      navigator.geolocation.clearWatch(liveTrackers.get(id));
      liveTrackers.delete(id);
      try { await request(`/location/${id}`, { method:"DELETE" }); } catch (_) {}
      toast("Live location sharing stopped.");
      renderBookings();
      return;
    }
    if (!navigator.geolocation) return toast("Location is not supported by this browser.", true);
    trackBtn.disabled = true;
    const watchId = navigator.geolocation.watchPosition(async position => {
      try {
        await request(`/location/${id}`, { method:"PUT", body:JSON.stringify({ latitude:position.coords.latitude, longitude:position.coords.longitude, accuracy:position.coords.accuracy }) });
      } catch (err) { toast(err.message, true); }
    }, error => {
      toast(error.message || "Location permission was denied.", true);
      if (liveTrackers.has(id)) navigator.geolocation.clearWatch(liveTrackers.get(id));
      liveTrackers.delete(id);
      renderBookings();
    }, { enableHighAccuracy:true, maximumAge:10000, timeout:15000 });
    liveTrackers.set(id, watchId);
    toast("Live location sharing started. Keep this page open while travelling.");
    renderBookings();
    return;
  }
  const paymentBtn = event.target.closest("[data-payment-id]");
  if (paymentBtn) {
    const booking = allBookings.find(item => item._id === paymentBtn.dataset.paymentId);
    if (!booking || !paymentSettings.enabled) return toast("QR payment is disabled by the administrator.", true);
    const amount = Number(booking.pricing?.total || booking.service?.price || 0);
    const uri = `upi://pay?pa=${encodeURIComponent(paymentSettings.upiId)}&pn=${encodeURIComponent(paymentSettings.payeeName || "HomeServe")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`${paymentSettings.paymentNote || "Home service payment"} ${booking.bookingCode || ""}`)}`;
    $("providerQrCode").innerHTML = "";
    new QRCode($("providerQrCode"), { text: uri, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
    $("providerQrAmount").textContent = money(amount);
    $("providerQrNote").textContent = `UPI: ${paymentSettings.upiId} · Controlled by HomeServe admin`;
    $("paymentModal").hidden = false;
    return;
  }
  const button = event.target.closest("[data-booking-id]");
  if (!button) return;
  button.disabled = true;
  const original = button.textContent;
  button.textContent = "Updating…";
  try {
    const result = await request(`/status/${button.dataset.bookingId}`, { method:"PUT", body:JSON.stringify({ status:button.dataset.nextStatus }) });
    toast(result.message);
    await loadDashboard();
  } catch (err) {
    button.disabled = false;
    button.textContent = original;
    toast(err.message, true);
  }
});

$("availabilityBtn").addEventListener("click", async () => {
  const next = !providerAvailable;
  try {
    const result = await request("/availability", { method:"PUT", body:JSON.stringify({ available:next }) });
    setAvailability(result.available);
    toast(result.message);
  } catch (err) { toast(err.message, true); }
});

$("jobSearch").addEventListener("input", renderBookings);
$("statusFilter").addEventListener("change", renderBookings);
$("refreshBtn").addEventListener("click", () => loadDashboard(true));
$("logoutBtn").addEventListener("click", () => { localStorage.clear(); sessionStorage.clear(); window.location.href = "login.html"; });
document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", () => $(button.dataset.closeModal).hidden = true));
document.querySelectorAll(".provider-modal").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) modal.hidden = true; }));

document.querySelectorAll("[data-scroll]").forEach(button => button.addEventListener("click", () => $(button.dataset.scroll).scrollIntoView({ behavior:"smooth", block:"start" })));

if (window.socket) {
  window.socket.on("new-booking", () => loadDashboard());
  window.socket.on("booking-status-updated", () => loadDashboard());
  window.socket.on("booking-cancelled", () => loadDashboard());
  window.socket.on("payment-status-updated", () => loadDashboard());
}

loadDashboard();

window.addEventListener("beforeunload", () => { liveTrackers.forEach(id => navigator.geolocation.clearWatch(id)); });
