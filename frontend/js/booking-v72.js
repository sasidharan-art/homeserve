const API_ORIGIN = window.location.origin;
const BOOKING_API = `${API_ORIGIN}/api/bookings`;
const SERVICE_API = `${API_ORIGIN}/api/services`;
const token = localStorage.getItem("token");
const serviceId = localStorage.getItem("serviceId");

if (!token) window.location.href = "login.html";

const state = { step: 1, service: null, selectedTime: "", basePrice: 0, customerLocation: null, coupon: null };
const slots = ["09:00 AM", "10:00 AM", "11:00 AM", "12:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM"];
const $ = id => document.getElementById(id);
const money = amount => `₹${Math.round(Number(amount || 0)).toLocaleString("en-IN")}`;

function safeBind(id, event, handler) {
  const element = $(id);
  if (element) element.addEventListener(event, handler);
}

safeBind("logoutBtn", "click", () => { localStorage.clear(); window.location.href = "login.html"; });

function serviceIcon(service) {
  const text = `${service?.name || ""} ${service?.category || ""}`.toLowerCase();
  if (text.includes("ac")) return "❄️";
  if (text.includes("electric")) return "⚡";
  if (text.includes("plumb")) return "🔧";
  if (text.includes("clean")) return "✨";
  if (text.includes("paint")) return "🎨";
  if (text.includes("garden")) return "🌿";
  if (text.includes("carpenter") || text.includes("wood")) return "🪚";
  return "🛠️";
}

function showMessage(text, type = "error") {
  const box = $("bookingMessage");
  if (!box) return;
  box.textContent = text;
  box.className = `booking-message show ${type}`;
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
  clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => box.classList.remove("show"), 5000);
}

function markInvalid(element) {
  if (!element) return;
  element.classList.add("field-invalid");
  element.focus({ preventScroll: true });
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => element.classList.remove("field-invalid"), 3000);
}

function calculatePrice() {
  const base = state.basePrice;
  const visit = 49;
  const emergency = $("emergency")?.checked ? Math.max(99, base * 0.15) : 0;
  const tax = (base + visit + emergency) * 0.18;
  const subtotal = Math.round(base + visit + emergency + tax);
  const discount = Number(state.coupon?.discount || 0);
  const total = Math.max(0, subtotal - discount);
  $("basePrice").textContent = money(base);
  $("visitCharge").textContent = money(visit);
  $("taxAmount").textContent = money(tax);
  $("emergencyCharge").textContent = money(emergency);
  $("emergencyPriceRow").hidden = emergency === 0;
  $("discountPriceRow").hidden = discount <= 0;
  $("discountAmount").textContent = `−${money(discount)}`;
  $("totalPrice").textContent = money(total);
  return { base, visit, emergency, tax: Math.round(tax), discount, couponCode: state.coupon?.code || "", total };
}

async function loadSelectedService() {
  if (!serviceId) {
    showMessage("No service was selected. Returning to services.");
    return setTimeout(() => location.href = "dashboard.html", 1300);
  }
  try {
    const response = await fetch(SERVICE_API, { cache: "no-store" });
    if (!response.ok) throw new Error("Unable to fetch services");
    const payload = await response.json();
    const services = Array.isArray(payload) ? payload : payload.services || [];
    state.service = services.find(service => String(service._id || service.id) === String(serviceId));
    if (!state.service) throw new Error("Selected service was not found");
    state.basePrice = Number(state.service.price || 0);
    const icon = serviceIcon(state.service);
    $("selectedServiceCard").innerHTML = `<div class="selected-service-icon">${icon}</div><div><span>${state.service.category || "Home service"}</span><h3>${state.service.name}</h3><p>${state.service.description || "Professional doorstep service."}</p><div class="selected-service-meta"><b>★ 4.8 rating</b><b>✓ Verified expert</b></div></div><strong>${money(state.basePrice)}</strong>`;
    $("summaryIcon").textContent = icon;
    $("summaryService").textContent = state.service.name;
    calculatePrice();
  } catch (error) {
    $("selectedServiceCard").innerHTML = `<div class="service-load-error">${error.message}. <a href="dashboard.html">Choose another service</a></div>`;
    showMessage(error.message);
  }
}

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function setMinimumDate() {
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const maxDate = new Date(minDate);
  maxDate.setDate(maxDate.getDate() + 60);
  $("bookingDate").min = localDateString(minDate);
  $("bookingDate").max = localDateString(maxDate);
}

async function renderSlots() {
  const selectedDate = $("bookingDate").value;
  state.selectedTime = "";
  $("summaryTime").textContent = "Not selected";
  if (!selectedDate) {
    $("timeSlots").innerHTML = "";
    $("slotHint").textContent = "Select a date first";
    return;
  }
  $("slotHint").textContent = "Checking availability…";
  let unavailable = [];
  try {
    const res = await fetch(`${BOOKING_API}/availability?service=${encodeURIComponent(serviceId)}&date=${encodeURIComponent(selectedDate)}`, { headers: { Authorization: token } });
    if (res.ok) unavailable = (await res.json()).unavailableSlots || [];
  } catch (_) {}
  $("timeSlots").innerHTML = "";
  slots.forEach(time => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "time-slot";
    button.textContent = time;
    button.disabled = unavailable.includes(time);
    if (button.disabled) button.title = "Already booked";
    button.addEventListener("click", () => {
      document.querySelectorAll(".time-slot").forEach(item => item.classList.remove("selected"));
      button.classList.add("selected");
      state.selectedTime = time;
      $("summaryTime").textContent = time;
      updateSummary();
    });
    $("timeSlots").appendChild(button);
  });
  $("slotHint").textContent = unavailable.length ? `${unavailable.length} slot(s) unavailable` : "All displayed slots are available";
  updateSummary();
}

function updateSummary() {
  const dateValue = $("bookingDate").value;
  $("summaryDate").textContent = dateValue ? new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) : "Not selected";
  const address = $("address").value.trim();
  $("summaryAddress").textContent = address ? (address.length > 44 ? `${address.slice(0, 44)}…` : address) : "Not added";
  $("summaryStatus").textContent = state.step === 4 ? "Ready" : "Draft";
  calculatePrice();
}

function validateStep() {
  if (state.step === 1 && !state.service) {
    showMessage("Please wait until the selected service loads.");
    return false;
  }
  if (state.step === 2) {
    if (!$("bookingDate").value) {
      showMessage("Select a service date before continuing.");
      markInvalid($("bookingDate"));
      return false;
    }
    if (!state.selectedTime) {
      showMessage("Choose one available time slot before continuing.");
      $("timeSlots").scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
  }
  if (state.step === 3) {
    let address = $("address").value.trim();
    if (address.length < 10 && state.customerLocation) {
      address = `Current GPS location (${state.customerLocation.latitude.toFixed(6)}, ${state.customerLocation.longitude.toFixed(6)})`;
      $("address").value = address;
      $("addressCount").textContent = address.length;
      updateSummary();
    }
    if (address.length < 10 && !state.customerLocation) {
      showMessage("Enter the service address or use the current-location button before continuing.");
      markInvalid($("address"));
      return false;
    }
  }
  if (state.step === 4 && !$("termsAccepted").checked) {
    showMessage("Confirm that the booking details are correct.");
    markInvalid($("termsAccepted"));
    return false;
  }
  return true;
}

function renderReview() {
  const pricing = calculatePrice();
  const date = $("summaryDate").textContent;
  $("reviewDetails").innerHTML = `
    <article><span>Service</span><strong>${state.service?.name || "—"}</strong><button type="button" data-edit="1">Edit</button></article>
    <article><span>Schedule</span><strong>${date}<br>${state.selectedTime}</strong><button type="button" data-edit="2">Edit</button></article>
    <article><span>Address</span><strong>${$("address").value.trim()}</strong><button type="button" data-edit="3">Edit</button></article>
    <article class="review-total"><span>Estimated total</span><strong>${money(pricing.total)}</strong></article>`;
  document.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => goToStep(Number(button.dataset.edit))));
}

function goToStep(step) {
  state.step = Math.min(4, Math.max(1, step));
  document.querySelectorAll(".wizard-step").forEach(section => section.classList.toggle("active", Number(section.dataset.step) === state.step));
  document.querySelectorAll(".wizard-progress-item").forEach(item => {
    const number = Number(item.dataset.progress);
    item.classList.toggle("active", number === state.step);
    item.classList.toggle("completed", number < state.step);
  });
  $("backBtn").hidden = state.step === 1;
  $("nextBtn").hidden = state.step === 4;
  $("confirmBtn").hidden = state.step !== 4;
  $("backBtn").style.display = state.step === 1 ? "none" : "inline-flex";
  $("nextBtn").style.display = state.step === 4 ? "none" : "inline-flex";
  $("confirmBtn").style.display = state.step === 4 ? "inline-flex" : "none";
  if (state.step === 4) renderReview();
  updateSummary();
  document.querySelector(".wizard-shell").scrollIntoView({ behavior: "smooth", block: "start" });
}

function combineDateAndTime() {
  const [time, meridiem] = state.selectedTime.split(" ");
  let [hours, minutes] = time.split(":").map(Number);
  if (meridiem === "PM" && hours !== 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  return new Date(`${$("bookingDate").value}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`).toISOString();
}

function buildAddressFromGeocode(data) {
  if (!data) return "";
  const a = data.address || {};
  const parts = [
    a.house_number,
    a.road || a.pedestrian || a.residential,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village || a.municipality,
    a.state_district,
    a.state,
    a.postcode
  ].filter(Boolean);
  return [...new Set(parts)].join(", ") || data.display_name || "";
}

async function reverseGeocode(latitude, longitude) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${BOOKING_API}/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`, {
      headers: { Authorization: token }, cache: "no-store", signal: controller.signal
    });
    if (!response.ok) return "";
    const payload = await response.json();
    return String(payload.address || "").trim();
  } catch (_) {
    return "";
  } finally {
    window.clearTimeout(timeout);
  }
}

safeBind("captureLocationBtn", "click", () => {
  if (!navigator.geolocation) return showMessage("Location is not supported by this browser.");
  const button = $("captureLocationBtn");
  const card = button.closest(".location-capture-card");
  button.disabled = true;
  button.textContent = "Getting location…";
  card?.classList.add("is-loading");
  navigator.geolocation.getCurrentPosition(async position => {
    state.customerLocation = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: Math.round(position.coords.accuracy || 0)
    };
    const fallback = `GPS location: ${state.customerLocation.latitude.toFixed(6)}, ${state.customerLocation.longitude.toFixed(6)}`;
    // Fill immediately so Continue never depends on an external address service.
    $("address").value = fallback;
    $("addressCount").textContent = fallback.length;
    $("locationStatus").textContent = `Location saved · accuracy about ${state.customerLocation.accuracy} m`;
    $("locationStatus").classList.add("ready");
    $("addressAutofillNote").textContent = "GPS is saved. You may continue now; a nearby street address is being checked in the background.";
    card?.classList.remove("is-loading");
    card?.classList.add("is-ready");
    updateSummary();
    button.textContent = "Finding nearby address…";
    showMessage("Location saved. You can continue now.", "success");

    const nearbyAddress = await reverseGeocode(state.customerLocation.latitude, state.customerLocation.longitude);
    // Do not overwrite a manual address entered while lookup was running.
    if (nearbyAddress && $("address").value === fallback) {
      $("address").value = nearbyAddress.slice(0, 300);
      $("addressCount").textContent = $("address").value.length;
      $("addressAutofillNote").textContent = "Nearby address filled automatically. Add the house/flat number or landmark when needed.";
      updateSummary();
      showMessage("Nearby address filled automatically.", "success");
    } else if (!nearbyAddress) {
      $("addressAutofillNote").textContent = "Street lookup was unavailable, but the exact GPS coordinates are saved and the booking can continue.";
    }
    button.disabled = false;
    button.textContent = "↻ Update location";
  }, error => {
    card?.classList.remove("is-loading");
    button.disabled = false;
    button.textContent = "⌖ Use current location";
    showMessage(error.code === 1 ? "Location permission was denied. You can still book using the written address." : "Unable to get your location. Please try again.");
  }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
});


async function applyCoupon() {
  const code = $("couponCode").value.trim().toUpperCase();
  const message = $("couponMessage");
  if (!code) { state.coupon = null; message.textContent = "Enter a coupon code."; message.className = "error"; return calculatePrice(); }
  const pricing = calculatePrice();
  const subtotal = pricing.total + pricing.discount;
  const button = $("applyCouponBtn");
  button.disabled = true; button.textContent = "Checking…";
  try {
    const response = await fetch(`${API_ORIGIN}/api/coupons/validate`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ code, subtotal }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Coupon could not be applied.");
    state.coupon = { code: data.coupon.code, discount: data.discount };
    message.textContent = `${data.coupon.code} applied — you save ${money(data.discount)}.`;
    message.className = "success";
    calculatePrice();
    showMessage("Coupon applied successfully.", "success");
  } catch (error) {
    state.coupon = null; message.textContent = error.message; message.className = "error"; calculatePrice();
  } finally { button.disabled = false; button.textContent = state.coupon ? "Applied" : "Apply"; }
}

safeBind("applyCouponBtn", "click", applyCoupon);
safeBind("couponCode", "input", () => { if (state.coupon && $("couponCode").value.trim().toUpperCase() !== state.coupon.code) { state.coupon = null; $("couponMessage").textContent = "Coupon changed. Apply it again."; $("applyCouponBtn").textContent = "Apply"; calculatePrice(); } });

safeBind("nextBtn", "click", () => { if (validateStep()) goToStep(state.step + 1); });
safeBind("backBtn", "click", () => goToStep(state.step - 1));
safeBind("bookingDate", "change", renderSlots);
safeBind("address", "input", () => {
  $("addressCount").textContent = $("address").value.length;
  $("address").classList.remove("field-invalid");
  updateSummary();
});
safeBind("emergency", "change", updateSummary);

document.querySelectorAll("[data-address-label]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-address-label]").forEach(item => item.classList.remove("selected"));
  button.classList.add("selected");
  $("address").focus();
  $("address").placeholder = `${button.dataset.addressLabel} address: House / flat number, street, area, city and pincode`;
}));

document.querySelectorAll(".wizard-progress-item").forEach(button => button.addEventListener("click", () => {
  const target = Number(button.dataset.progress);
  if (target < state.step) goToStep(target);
}));

safeBind("bookingForm", "submit", async event => {
  event.preventDefault();
  if (!validateStep()) return;
  const confirm = $("confirmBtn");
  confirm.disabled = true;
  confirm.textContent = "Confirming…";
  const pricing = calculatePrice();
  const booking = {
    service: serviceId,
    bookingDate: combineDateAndTime(),
    timeSlot: state.selectedTime,
    address: $("address").value.trim(),
    notes: $("notes").value.trim(),
    emergency: $("emergency").checked,
    pricing,
    customerLocation: state.customerLocation,
    couponCode: state.coupon?.code || ""
  };
  try {
    const response = await fetch(BOOKING_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: token },
      body: JSON.stringify(booking)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Booking could not be created");
    localStorage.removeItem("serviceId");
    $("successBookingCode").textContent = data.booking?.bookingCode || String(data.booking?._id || "").slice(-8).toUpperCase();
    $("successModal").hidden = false;
  } catch (error) {
    showMessage(error.message);
    confirm.disabled = false;
    confirm.textContent = "Confirm booking";
  }
});

setMinimumDate();
loadSelectedService();
updateSummary();
goToStep(1);
