(() => {
  const token = localStorage.getItem("token");
  if (!token) return;
  const API = `${window.location.origin}/api`;
  const role = localStorage.getItem("role") || "customer";
  const pageLink = role === "admin" ? "admin.html" : role === "provider" ? "provider.html" : "my-bookings.html";

  let button = document.getElementById("notificationBtn");
  let panel = document.getElementById("notificationPanel");
  if (!button || !panel) {
    const wrap = document.createElement("div");
    wrap.className = "hs-notification-float";
    wrap.innerHTML = `<button id="notificationBtn" class="hs-notification-button" aria-label="Notifications">🔔<b hidden>0</b></button><div id="notificationPanel" class="hs-notification-panel"><div class="hs-notification-head"><strong>Notifications</strong><button type="button" data-read-all>Mark all read</button></div><div data-notification-list><p class="hs-notification-state">Loading notifications…</p></div></div>`;
    document.body.appendChild(wrap);
    button = wrap.querySelector("#notificationBtn");
    panel = wrap.querySelector("#notificationPanel");
  } else {
    panel.innerHTML = `<div class="hs-notification-head"><strong>Notifications</strong><button type="button" data-read-all>Mark all read</button></div><div data-notification-list><p class="hs-notification-state">Loading notifications…</p></div>`;
  }

  const badge = button.querySelector("b") || (() => { const b=document.createElement("b"); button.appendChild(b); return b; })();
  const list = panel.querySelector("[data-notification-list]");
  const readAll = panel.querySelector("[data-read-all]");
  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
  const iconFor = type => ({ booking:"▣", payment:"₹", review:"★", system:"i" }[type] || "i");
  const relativeTime = value => {
    const seconds = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds/3600)}h ago`;
    return `${Math.floor(seconds/86400)}d ago`;
  };

  async function request(path, options={}) {
    const response = await fetch(`${API}${path}`, { ...options, headers:{ "Content-Type":"application/json", Authorization:`Bearer ${token}`, ...(options.headers||{}) }, cache:"no-store" });
    if (response.status === 401) { localStorage.clear(); location.href="login.html?reason=session"; throw new Error("Session expired"); }
    const data = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(data.message || "Notification request failed.");
    return data;
  }

  function render(items, unreadCount) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.hidden = unreadCount === 0;
    if (!items.length) {
      list.innerHTML = `<div class="hs-notification-empty"><span>✓</span><strong>You're all caught up</strong><p>Booking and payment updates will appear here.</p></div>`;
      return;
    }
    list.innerHTML = items.map(item => `<article class="hs-notification-item${item.read ? "" : " unread"}" data-id="${escapeHtml(item._id)}" data-link="${escapeHtml(item.link || pageLink)}"><i>${iconFor(item.type)}</i><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${relativeTime(item.createdAt)}</small></div><span class="hs-unread-dot"></span></article>`).join("");
    list.querySelectorAll(".hs-notification-item").forEach(item => item.addEventListener("click", async () => {
      try { await request(`/notifications/${item.dataset.id}/read`, { method:"PATCH" }); } catch (_) {}
      const link = item.dataset.link;
      if (link) location.href = link;
    }));
  }

  async function loadNotifications() {
    try {
      const data = await request("/notifications?limit=25");
      render(data.notifications || [], Number(data.unreadCount || 0));
    } catch (error) {
      list.innerHTML = `<p class="hs-notification-state error">${escapeHtml(error.message)}</p>`;
    }
  }

  button.addEventListener("click", event => { event.stopPropagation(); panel.classList.toggle("open"); if (panel.classList.contains("open")) loadNotifications(); });
  panel.addEventListener("click", event => event.stopPropagation());
  document.addEventListener("click", () => panel.classList.remove("open"));
  readAll.addEventListener("click", async () => { try { await request("/notifications/read-all", { method:"PATCH" }); await loadNotifications(); } catch (_) {} });

  if (window.io) {
    try {
      const socket = window.io(window.location.origin);
      socket.on("notification-created", event => {
        const userId = localStorage.getItem("userId") || localStorage.getItem("id");
        if (!event.user || String(event.user) === String(userId) || event.role === role || event.role === "all") loadNotifications();
      });
    } catch (_) {}
  }
  loadNotifications();
  window.setInterval(loadNotifications, 30000);
})();
