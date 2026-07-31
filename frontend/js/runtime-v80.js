(() => {
  const host = window.location.hostname || "localhost";
  const protocol = window.location.protocol === "https:" ? "https:" : "http:";
  const apiProtocol = host === "localhost" || host === "127.0.0.1" ? "http:" : protocol;
  const apiPort = host === "localhost" || host === "127.0.0.1" ? ":5000" : "";
  window.HOMESERVE = Object.freeze({
    API_ORIGIN: `${apiProtocol}//${host}${apiPort}`,
    API: `${apiProtocol}//${host}${apiPort}/api`,
    SOCKET_ORIGIN: `${apiProtocol}//${host}${apiPort}`,
    BUILD: "8.0.0"
  });

  window.getAuthToken = () => localStorage.getItem("token") || "";
  window.authHeaders = (json = false) => {
    const headers = {};
    const token = window.getAuthToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  };

  window.notify = (message, type = "info", timeout = 3600) => {
    let stack = document.getElementById("toastStack");
    if (!stack) {
      stack = document.createElement("div");
      stack.id = "toastStack";
      stack.className = "toast-stack";
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    const toast = document.createElement("div");
    toast.className = `app-toast ${type}`;
    toast.textContent = String(message || "Something went wrong.");
    stack.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, timeout);
  };

  window.parseApiResponse = async (response) => {
    const text = await response.text();
    try { return text ? JSON.parse(text) : {}; }
    catch { return { success: false, message: text || "Unexpected server response." }; }
  };

  window.requireRole = (roles) => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!token || !allowed.includes(role)) {
      sessionStorage.setItem("authNotice", "Please sign in with an authorized account.");
      location.replace("login.html");
      return false;
    }
    return true;
  };
})();
