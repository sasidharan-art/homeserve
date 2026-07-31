const API_ORIGIN = window.location.origin;
const AUTH_API = `${API_ORIGIN}/api/auth`;

function authMessage(message = "", type = "error") {
  let box = document.getElementById("authMessage");
  if (!box) {
    box = document.createElement("div");
    box.id = "authMessage";
    box.className = "auth-message";
    const form = document.querySelector("form");
    form?.prepend(box);
  }
  box.textContent = message;
  box.className = `auth-message ${type}`;
  box.hidden = !message;
}

async function parseResponse(response) {
  const text = await response.text();
  try { return text ? JSON.parse(text) : {}; }
  catch { return { message: text || "Unexpected server response." }; }
}

const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authMessage("");
    const button = event.submitter || registerForm.querySelector('button[type="submit"]');
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "Creating account…"; }
    try {
      const payload = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        password: document.getElementById("password").value
      };
      const response = await fetch(`${AUTH_API}/register`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await parseResponse(response);
      if (!response.ok) throw new Error(data.message || "Registration failed.");
      sessionStorage.setItem("authNotice", "Account created. Log in with your new credentials.");
      location.replace("login.html");
    } catch (error) {
      authMessage(error.message || "Unable to create account.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  });
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const notice = sessionStorage.getItem("authNotice");
  if (notice) { authMessage(notice, "success"); sessionStorage.removeItem("authNotice"); }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    authMessage("");
    const button = event.submitter || loginForm.querySelector('button[type="submit"]');
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = "Signing in…"; }

    // Remove stale sessions before a fresh login.
    ["token","role","name"].forEach(key => localStorage.removeItem(key));

    try {
      const identifier = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const response = await fetch(`${AUTH_API}/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ identifier, password }) });
      const data = await parseResponse(response);
      if (!response.ok || !data.token) throw new Error(data.message || "Invalid email/phone number or password.");

      localStorage.setItem("token", data.token);
      localStorage.setItem("name", data.name || "User");
      localStorage.setItem("role", data.role || "customer");

      // No success popup: redirect immediately after a valid login.
      const destination = data.role === "admin" ? "admin.html" : data.role === "provider" ? "provider.html" : "dashboard.html";
      location.replace(destination);
    } catch (error) {
      // Only errors are displayed.
      authMessage(error.message || "Unable to sign in.", "error");
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  });
}
