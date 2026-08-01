"use strict";

const isLiveServer =
    window.location.port === "5500" ||
    window.location.port === "8080";

const API_ORIGIN = isLiveServer
    ? "http://localhost:5000"
    : window.location.origin;

const API_BASE = `${API_ORIGIN}/api/auth`;

const state = {
    identifier: "",
    resetToken: "",
    currentStep: 1,
    requestInProgress: false
};

const elements = {
    message: document.getElementById("message"),

    pageTitle: document.getElementById("pageTitle"),
    pageSubtitle: document.getElementById("pageSubtitle"),

    contactStep: document.getElementById("contactStep"),
    otpStep: document.getElementById("otpStep"),
    passwordStep: document.getElementById("passwordStep"),
    doneStep: document.getElementById("doneStep"),

    contactForm: document.getElementById("contactForm"),
    otpForm: document.getElementById("otpForm"),
    passwordForm: document.getElementById("passwordForm"),

    identifierInput: document.getElementById("identifierInput"),
    otpInput: document.getElementById("otpInput"),
    newPasswordInput: document.getElementById("newPasswordInput"),
    confirmPasswordInput: document.getElementById(
        "confirmPasswordInput"
    ),

    sendOtpButton: document.getElementById("sendOtpButton"),
    verifyOtpButton: document.getElementById("verifyOtpButton"),
    resendOtpButton: document.getElementById("resendOtpButton"),
    resetPasswordButton: document.getElementById(
        "resetPasswordButton"
    ),

    stepIndicators: [
        document.getElementById("stepIndicator1"),
        document.getElementById("stepIndicator2"),
        document.getElementById("stepIndicator3"),
        document.getElementById("stepIndicator4")
    ]
};

function showMessage(message, type = "error") {
    elements.message.textContent = message;
    elements.message.className = `message ${type}`;
}

function clearMessage() {
    elements.message.textContent = "";
    elements.message.className = "message";
}

function setButtonLoading(button, loading, normalText) {
    button.disabled = loading;
    button.textContent = loading ? "Please wait..." : normalText;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function readJsonResponse(response) {
    const contentType = response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
        throw new Error("The server returned an invalid response.");
    }

    const data = await response.json();

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}

async function postJson(path, body) {
    const response = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify(body)
    });

    return readJsonResponse(response);
}

function updateStepIndicators(stepNumber) {
    elements.stepIndicators.forEach((indicator, index) => {
        const indicatorStep = index + 1;

        indicator.classList.remove("active", "completed");

        if (indicatorStep < stepNumber) {
            indicator.classList.add("completed");
        } else if (indicatorStep === stepNumber) {
            indicator.classList.add("active");
        }
    });
}

function showStep(stepNumber) {
    state.currentStep = stepNumber;

    const sections = [
        elements.contactStep,
        elements.otpStep,
        elements.passwordStep,
        elements.doneStep
    ];

    sections.forEach((section, index) => {
        section.classList.toggle(
            "active",
            index + 1 === stepNumber
        );
    });

    updateStepIndicators(stepNumber);
    clearMessage();

    if (stepNumber === 1) {
        elements.pageTitle.textContent = "Reset your password";
        elements.pageSubtitle.textContent =
            "Receive a verification code at your registered email address.";

        elements.identifierInput.focus();
    }

    if (stepNumber === 2) {
        elements.pageTitle.textContent = "Verify your email";
        elements.pageSubtitle.textContent =
            `Enter the 6-digit OTP sent to ${state.identifier}.`;

        elements.otpInput.value = "";
        elements.otpInput.focus();
    }

    if (stepNumber === 3) {
        elements.pageTitle.textContent = "Create a new password";
        elements.pageSubtitle.textContent =
            "Choose a secure password for your HomeServe account.";

        elements.newPasswordInput.focus();
    }

    if (stepNumber === 4) {
        elements.pageTitle.textContent = "Password updated";
        elements.pageSubtitle.textContent =
            "Your HomeServe account is ready to use.";
    }
}

async function requestEmailOtp({ isResend = false } = {}) {
    if (state.requestInProgress) {
        return;
    }

    const identifier = isResend
        ? state.identifier
        : elements.identifierInput.value.trim().toLowerCase();

    if (!isValidEmail(identifier)) {
        showMessage(
            "Enter a valid registered email address.",
            "error"
        );
        return;
    }

    state.requestInProgress = true;
    state.identifier = identifier;

    const button = isResend
        ? elements.resendOtpButton
        : elements.sendOtpButton;

    const normalText = isResend
        ? "Resend Email OTP"
        : "Send Email OTP";

    setButtonLoading(button, true, normalText);
    clearMessage();

    try {
        const data = await postJson(
            "/forgot-password/request-otp",
            {
                identifier,
                channel: "email"
            }
        );

        if (!isResend) {
            showStep(2);
        }

        showMessage(
            data.message ||
            "OTP sent successfully to your registered email.",
            "success"
        );

        // Only displayed when OTP_DEV_MODE=true.
        if (data.devOtp) {
            showMessage(
                `${data.message} Development OTP: ${data.devOtp}`,
                "success"
            );
        }
    } catch (error) {
        showMessage(
            error.message ||
            "Unable to send email OTP. Please try again.",
            "error"
        );
    } finally {
        state.requestInProgress = false;
        setButtonLoading(button, false, normalText);
    }
}

elements.contactForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();
        await requestEmailOtp();
    }
);

elements.resendOtpButton.addEventListener(
    "click",
    async () => {
        await requestEmailOtp({ isResend: true });
    }
);

elements.otpInput.addEventListener("input", () => {
    elements.otpInput.value = elements.otpInput.value
        .replace(/\D/g, "")
        .slice(0, 6);
});

elements.otpForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const otp = elements.otpInput.value.trim();

        if (!/^\d{6}$/.test(otp)) {
            showMessage(
                "Enter the complete 6-digit OTP.",
                "error"
            );
            return;
        }

        setButtonLoading(
            elements.verifyOtpButton,
            true,
            "Verify OTP"
        );

        clearMessage();

        try {
            const data = await postJson(
                "/forgot-password/verify-otp",
                {
                    identifier: state.identifier,
                    otp
                }
            );

            if (!data.resetToken) {
                throw new Error(
                    "The reset token was not returned by the server."
                );
            }

            state.resetToken = data.resetToken;
            showStep(3);

            showMessage(
                data.message ||
                "OTP verified successfully.",
                "success"
            );
        } catch (error) {
            showMessage(
                error.message ||
                "Unable to verify OTP.",
                "error"
            );
        } finally {
            setButtonLoading(
                elements.verifyOtpButton,
                false,
                "Verify OTP"
            );
        }
    }
);

elements.passwordForm.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const newPassword =
            elements.newPasswordInput.value;

        const confirmPassword =
            elements.confirmPasswordInput.value;

        if (newPassword.length < 8) {
            showMessage(
                "Password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (
            !/[a-z]/.test(newPassword) ||
            !/[A-Z]/.test(newPassword) ||
            !/\d/.test(newPassword)
        ) {
            showMessage(
                "Password must include uppercase, lowercase and a number.",
                "error"
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage(
                "The password confirmation does not match.",
                "error"
            );
            return;
        }

        if (!state.resetToken) {
            showMessage(
                "Your reset session is missing. Request another OTP.",
                "error"
            );
            showStep(1);
            return;
        }

        setButtonLoading(
            elements.resetPasswordButton,
            true,
            "Reset Password"
        );

        clearMessage();

        try {
            await postJson(
                "/forgot-password/reset",
                {
                    identifier: state.identifier,
                    resetToken: state.resetToken,
                    newPassword
                }
            );

            state.resetToken = "";
            showStep(4);
        } catch (error) {
            showMessage(
                error.message ||
                "Unable to reset the password.",
                "error"
            );
        } finally {
            setButtonLoading(
                elements.resetPasswordButton,
                false,
                "Reset Password"
            );
        }
    }
);

showStep(1);