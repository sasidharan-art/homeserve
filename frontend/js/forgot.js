const API_ORIGIN = (() => {
    const runtimeOrigin = window.HOMESERVE?.ORIGIN;
    if (runtimeOrigin) return runtimeOrigin;

    const isLiveServer = ["5500", "8080"].includes(window.location.port);
    return isLiveServer ? "http://127.0.0.1:5000" : window.location.origin;
})();
const API_URL = `${API_ORIGIN}/api/auth`;

const requestOtpForm = document.getElementById("requestOtpForm");
const verifyOtpForm = document.getElementById("verifyOtpForm");
const resetPasswordForm = document.getElementById("resetPasswordForm");
const successPanel = document.getElementById("resetSuccessPanel");

const identifierInput = document.getElementById("identifier");
const otpChannelInput = document.getElementById("otpChannel");
const otpInput = document.getElementById("otp");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const passwordStrength = document.getElementById("passwordStrength");
const passwordMatch = document.getElementById("passwordMatch");
const otpTimer = document.getElementById("otpTimer");
const stepItems = [...document.querySelectorAll("[data-reset-step]")];

const sendOtpButton = document.getElementById("sendOtpButton");
const verifyOtpButton = document.getElementById("verifyOtpButton");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const resendOtpButton = document.getElementById("resendOtpButton");
const changeContactButton = document.getElementById("changeContactButton");
const toggleButtons = [...document.querySelectorAll("[data-toggle-password]")];
const messageBox = document.getElementById("forgotMessage");

let currentIdentifier = "";
let currentChannel = "email";
let resetToken = "";
let countdownId = null;
let remainingSeconds = 0;
const RESET_SESSION_KEY = "homeservePasswordResetSession";

function saveResetSession(step) {
    sessionStorage.setItem(RESET_SESSION_KEY, JSON.stringify({
        identifier: currentIdentifier,
        channel: currentChannel,
        resetToken,
        step
    }));
}

function clearResetSession() {
    sessionStorage.removeItem(RESET_SESSION_KEY);
}


function setStep(step) {
    stepItems.forEach((item) => {
        const itemStep = Number(item.dataset.resetStep);
        item.classList.toggle("active", itemStep === step);
        item.classList.toggle("complete", itemStep < step);
    });
}

function showOnly(form) {
    [requestOtpForm, verifyOtpForm, resetPasswordForm, successPanel].forEach((element) => {
        if (element) element.hidden = element !== form;
    });
}

function showMessage(message, type = "success") {
    messageBox.textContent = message;
    messageBox.className = `page-message reset-message ${type}`;
    messageBox.hidden = false;
}

function clearMessage() {
    messageBox.textContent = "";
    messageBox.hidden = true;
}

function setButtonLoading(button, loading, normalText) {
    button.disabled = loading;
    button.innerHTML = loading
        ? '<span class="button-spinner" aria-hidden="true"></span>Please wait...'
        : normalText;
}

function normalizeIdentifier(value, channel = currentChannel) {
    const raw = String(value || "").trim();
    if (!raw || raw.includes("@")) return raw.toLowerCase();

    const digits = raw.replace(/\D/g, "");

    // Accept ordinary 10-digit Indian numbers and convert them to E.164 for SMS.
    if (channel === "sms") {
        if (digits.length === 10) return `+91${digits}`;
        if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
        if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) return `+${digits}`;
    }

    return raw;
}

function isValidIdentifier(value) {
    const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phone = /^\+?[0-9][0-9\s-]{8,14}$/;
    return email.test(value) || phone.test(value);
}

function startCountdown(seconds = 600) {
    clearInterval(countdownId);
    remainingSeconds = seconds;
    resendOtpButton.disabled = true;

    const update = () => {
        const minutes = Math.floor(remainingSeconds / 60);
        const secondsPart = String(remainingSeconds % 60).padStart(2, "0");
        otpTimer.textContent = remainingSeconds > 0
            ? `Code expires in ${minutes}:${secondsPart}`
            : "Code expired. Request a new OTP.";

        resendOtpButton.textContent = remainingSeconds > 0
            ? `Resend OTP in ${remainingSeconds}s`
            : "Resend OTP";

        if (remainingSeconds <= 0) {
            resendOtpButton.disabled = false;
            clearInterval(countdownId);
            return;
        }

        remainingSeconds -= 1;
        if (remainingSeconds <= 540) resendOtpButton.disabled = false;
    };

    update();
    countdownId = setInterval(update, 1000);
}

async function readJson(response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : {};
    } catch {
        return { message: "The server returned an invalid response." };
    }
}

async function sendOtp({ isResend = false } = {}) {
    clearMessage();
    const enteredIdentifier = normalizeIdentifier(identifierInput.value, otpChannelInput.value);
    currentIdentifier = enteredIdentifier || currentIdentifier;
    currentChannel = otpChannelInput.value || currentChannel;

    if (!currentIdentifier || !isValidIdentifier(currentIdentifier)) {
        showMessage("Enter a valid registered email address or phone number.", "error");
        identifierInput.focus();
        return;
    }

    const activeButton = isResend ? resendOtpButton : sendOtpButton;
    setButtonLoading(activeButton, true, isResend ? "Resend OTP" : "Send OTP");

    try {
        const response = await fetch(`${API_URL}/forgot-password/request-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: currentIdentifier,
                channel: currentChannel
            })
        });

        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || "Unable to send OTP.");

        showOnly(verifyOtpForm);
        setStep(2);
        saveResetSession(2);
        otpInput.value = "";
        startCountdown(Number(data.expiresInSeconds) || 600);

        let message = data.message || "OTP sent successfully.";
        if (data.devOtp) message += ` Development OTP: ${data.devOtp}`;
        showMessage(message, "success");
        otpInput.focus();
    } catch (error) {
        showMessage(error.message || "Unable to connect to the server.", "error");
    } finally {
        setButtonLoading(activeButton, false, isResend ? "Resend OTP" : "Send OTP");
    }
}

requestOtpForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await sendOtp();
});

verifyOtpForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const otp = otpInput.value.replace(/\D/g, "").slice(0, 6);
    otpInput.value = otp;

    if (!/^\d{6}$/.test(otp)) {
        showMessage("Enter the complete 6-digit OTP.", "error");
        otpInput.focus();
        return;
    }

    setButtonLoading(verifyOtpButton, true, "Verify OTP");

    try {
        const response = await fetch(`${API_URL}/forgot-password/verify-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ identifier: currentIdentifier, otp })
        });

        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || "OTP verification failed.");

        resetToken = data.resetToken;
        if (!resetToken) throw new Error("Reset token was not received.");

        clearInterval(countdownId);
        showOnly(resetPasswordForm);
        setStep(3);
        saveResetSession(3);
        showMessage(data.message || "OTP verified. Create your new password.", "success");
        newPasswordInput.focus();
    } catch (error) {
        showMessage(error.message || "Unable to verify OTP.", "error");
    } finally {
        setButtonLoading(verifyOtpButton, false, "Verify OTP");
    }
});

function passwordScore(password) {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
}

function updatePasswordFeedback() {
    const password = newPasswordInput.value;
    const score = passwordScore(password);
    const labels = ["Use at least 8 characters", "Weak password", "Fair password", "Good password", "Strong password"];
    passwordStrength.textContent = labels[score];
    passwordStrength.dataset.score = String(score);

    if (!confirmPasswordInput.value) {
        passwordMatch.textContent = "";
        return;
    }

    const matches = password === confirmPasswordInput.value;
    passwordMatch.textContent = matches ? "Passwords match" : "Passwords do not match";
    passwordMatch.className = `field-feedback ${matches ? "valid" : "invalid"}`;
}

newPasswordInput?.addEventListener("input", updatePasswordFeedback);
confirmPasswordInput?.addEventListener("input", updatePasswordFeedback);

resetPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (newPassword.length < 8 || passwordScore(newPassword) < 3) {
        showMessage("Use at least 8 characters with uppercase, lowercase, a number and preferably a symbol.", "error");
        newPasswordInput.focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage("The two passwords do not match.", "error");
        confirmPasswordInput.focus();
        return;
    }

    if (!currentIdentifier || !resetToken) {
        showMessage("Your reset session is missing or expired. Request another OTP.", "error");
        showOnly(requestOtpForm);
        setStep(1);
        return;
    }

    setButtonLoading(resetPasswordButton, true, "Reset password");

    try {
        const response = await fetch(`${API_URL}/forgot-password/reset`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                identifier: currentIdentifier,
                resetToken,
                newPassword
            })
        });

        const data = await readJson(response);
        if (!response.ok) throw new Error(data.message || "Password reset failed.");

        resetToken = "";
        clearResetSession();
        showOnly(successPanel);
        setStep(4);
        clearMessage();
    } catch (error) {
        showMessage(error.message || "Unable to reset password.", "error");
    } finally {
        setButtonLoading(resetPasswordButton, false, "Reset password");
    }
});

resendOtpButton?.addEventListener("click", async () => sendOtp({ isResend: true }));

changeContactButton?.addEventListener("click", () => {
    clearInterval(countdownId);
    resetToken = "";
    clearResetSession();
    otpInput.value = "";
    showOnly(requestOtpForm);
    setStep(1);
    clearMessage();
    identifierInput.focus();
});

otpInput?.addEventListener("input", () => {
    otpInput.value = otpInput.value.replace(/\D/g, "").slice(0, 6);
});

toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.togglePassword);
        if (!input) return;
        const visible = input.type === "text";
        input.type = visible ? "password" : "text";
        button.textContent = visible ? "Show" : "Hide";
        button.setAttribute("aria-pressed", String(!visible));
    });
});

try {
    const saved = JSON.parse(sessionStorage.getItem(RESET_SESSION_KEY) || "null");
    if (saved?.identifier) {
        currentIdentifier = saved.identifier;
        currentChannel = saved.channel || "email";
        identifierInput.value = currentIdentifier;
        otpChannelInput.value = currentChannel;
    }
    if (saved?.step === 3 && saved?.resetToken) {
        resetToken = saved.resetToken;
        showOnly(resetPasswordForm);
        setStep(3);
        showMessage("Reset session restored. Enter your new password.", "success");
    } else if (saved?.step === 2 && saved?.identifier) {
        showOnly(verifyOtpForm);
        setStep(2);
        startCountdown(600);
    } else {
        showOnly(requestOtpForm);
        setStep(1);
    }
} catch {
    clearResetSession();
    showOnly(requestOtpForm);
    setStep(1);
}
