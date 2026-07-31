(() => {
  const API = window.HOMESERVE?.API || `${window.location.origin}/api`;
  const showMessage = (message = "", type = "error") => {
    let box = document.getElementById("authMessage");
    const form = document.querySelector("form");
    if (!box && form) {
      box = document.createElement("div");
      box.id = "authMessage";
      form.prepend(box);
    }
    if (!box) return;
    box.textContent = message;
    box.className = `auth-message ${type}`;
    box.hidden = !message;
  };
  const setBusy = (form, busy, text) => {
    const button = form.querySelector('button[type="submit"]');
    if (!button) return;
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? text : button.dataset.originalText;
  };

  const notice = sessionStorage.getItem("authNotice");
  if (notice) {
    showMessage(notice, "success");
    sessionStorage.removeItem("authNotice");
  }

  const loginForm = document.getElementById("loginForm");
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");
    setBusy(loginForm, true, "Signing in…");
    ["token", "role", "name"].forEach(key => localStorage.removeItem(key));
    try {
      const identifier = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const response = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });
      const data = await window.parseApiResponse(response);
      if (!response.ok || !data.token) throw new Error(data.message || "Invalid email/phone number or password.");
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role || "customer");
      localStorage.setItem("name", data.name || "User");
      const destination = data.role === "admin" ? "admin.html" : data.role === "provider" ? "provider.html" : "dashboard.html";
      location.replace(destination);
    } catch (error) {
      showMessage(error.message || "Unable to sign in.", "error");
    } finally {
      setBusy(loginForm, false);
    }
  });

  const registerForm = document.getElementById("registerForm");
  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage("");
    setBusy(registerForm, true, "Creating account…");
    try {
      const payload = {
        name: document.getElementById("name").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value
      };
      const response = await fetch(`${API}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await window.parseApiResponse(response);
      if (!response.ok) throw new Error(data.message || "Registration failed.");
      sessionStorage.setItem("authNotice", "Account created. Sign in with your new credentials.");
      location.replace("login.html");
    } catch (error) {
      showMessage(error.message || "Unable to create account.", "error");
    } finally {
      setBusy(registerForm, false);
    }
  });
})();
