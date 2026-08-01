"use strict";

const API = `${window.location.origin}/api/admin`;

const token = localStorage.getItem("token");
const role = localStorage.getItem("role");

const serviceForm = document.getElementById("serviceForm");
const serviceIdInput = document.getElementById("serviceId");
const nameInput = document.getElementById("name");
const descriptionInput = document.getElementById("description");
const categoryInput = document.getElementById("category");
const priceInput = document.getElementById("price");

const formTitle = document.getElementById("formTitle");
const saveBtn = document.getElementById("saveBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

const serviceList = document.getElementById("serviceList");
const serviceMessage = document.getElementById("serviceMessage");
const serviceSearch = document.getElementById("serviceSearch");

let allServices = [];

if (!token || role !== "admin") {
    window.location.href = "login.html";
}

document
    .getElementById("logoutBtn")
    ?.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });

async function readResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    let data = {};

    if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        const text = await response.text();

        data = {
            message:
                text ||
                "The server returned an invalid response."
        };
    }

    if (!response.ok) {
        throw new Error(
            data.message ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function getServiceIcon(service) {
    const category = String(
        service.category || ""
    ).toLowerCase();

    const name = String(
        service.name || ""
    ).toLowerCase();

    if (
        name.includes("electric") ||
        category.includes("electric")
    ) {
        return "⚡";
    }

    if (
        name.includes("plumb") ||
        category.includes("plumb")
    ) {
        return "🔧";
    }

    if (
        name.includes("clean") ||
        category.includes("clean")
    ) {
        return "🧹";
    }

    if (
        name.includes("paint") ||
        category.includes("paint")
    ) {
        return "🎨";
    }

    if (
        name.includes("ac") ||
        category.includes("appliance")
    ) {
        return "❄️";
    }

    if (
        name.includes("carpent") ||
        name.includes("wood") ||
        category.includes("wood")
    ) {
        return "🪚";
    }

    if (
        name.includes("garden") ||
        category.includes("outdoor")
    ) {
        return "🌿";
    }

    if (
        name.includes("pest")
    ) {
        return "🐜";
    }

    return "🏠";
}

function formatPrice(value) {
    return `₹${Number(value || 0).toLocaleString(
        "en-IN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }
    )}`;
}

function showListMessage(message, type = "") {
    if (!serviceMessage) {
        return;
    }

    serviceMessage.textContent = message;

    serviceMessage.className =
        `page-message${
            type ? ` ${type}` : ""
        }`;
}

function clearListMessage() {
    if (!serviceMessage) {
        return;
    }

    serviceMessage.textContent = "";
    serviceMessage.className = "page-message";
}

function renderServices(services) {
    if (!serviceList) {
        return;
    }

    serviceList.innerHTML = "";

    if (!Array.isArray(services) || !services.length) {
        serviceList.innerHTML = `
            <div class="service-empty-state">
                <h3>No services found</h3>
                <p>
                    Add a new service or try another search.
                </p>
            </div>
        `;

        return;
    }

    services.forEach((service) => {
        const card = document.createElement("article");

        card.className = "admin-service-card";

        card.innerHTML = `
            <div class="admin-service-card-top">
                <div class="admin-service-icon">
                    ${getServiceIcon(service)}
                </div>

                <div class="admin-service-card-content">
                    <h3>
                        ${escapeHtml(
                            service.name ||
                            "Unnamed Service"
                        )}
                    </h3>

                    <span class="admin-service-category">
                        ${escapeHtml(
                            service.category ||
                            "Uncategorised"
                        )}
                    </span>

                    <strong class="admin-service-price">
                        ${formatPrice(service.price)}
                    </strong>

                    <p class="admin-service-description">
                        ${escapeHtml(
                            service.description ||
                            "No description available."
                        )}
                    </p>
                </div>
            </div>

            <div class="admin-service-card-actions">
                <button
                    class="admin-service-edit"
                    type="button"
                >
                    ✎ Edit
                </button>

                <button
                    class="admin-service-delete"
                    type="button"
                >
                    🗑 Delete
                </button>
            </div>
        `;

        card
            .querySelector(".admin-service-edit")
            ?.addEventListener("click", () => {
                startEdit(service);
            });

        card
            .querySelector(".admin-service-delete")
            ?.addEventListener("click", () => {
                deleteService(service._id);
            });

        serviceList.appendChild(card);
    });
}

function applySearch() {
    const query = String(
        serviceSearch?.value || ""
    )
        .trim()
        .toLowerCase();

    if (!query) {
        renderServices(allServices);
        return;
    }

    const filtered = allServices.filter((service) => {
        const searchableText = `
            ${service.name || ""}
            ${service.description || ""}
            ${service.category || ""}
            ${service.price || ""}
        `.toLowerCase();

        return searchableText.includes(query);
    });

    renderServices(filtered);
}

async function loadServices() {
    if (!serviceList) {
        return;
    }

    serviceList.innerHTML = "";
    showListMessage(
        "Loading services...",
        "loading-state"
    );

    try {
        const response = await fetch(
            `${API}/services`,
            {
                headers: {
                    Authorization: token,
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        const services = await readResponse(response);

        allServices = Array.isArray(services)
            ? services
            : Array.isArray(services.services)
                ? services.services
                : [];

        clearListMessage();

        if (!allServices.length) {
            showListMessage(
                "No services available.",
                "empty-state"
            );
        }

        applySearch();
    } catch (error) {
        console.error(error);

        showListMessage(
            error.message,
            "error-state"
        );

        renderServices([]);
    }
}

serviceSearch?.addEventListener(
    "input",
    applySearch
);

serviceForm?.addEventListener(
    "submit",
    async (event) => {
        event.preventDefault();

        const service = {
            name: nameInput.value.trim(),
            description:
                descriptionInput.value.trim(),
            category:
                categoryInput.value.trim(),
            price: Number(priceInput.value)
        };

        if (
            !service.name ||
            !service.description ||
            !service.category ||
            Number.isNaN(service.price) ||
            service.price < 0
        ) {
            notify(
                "Enter valid service details.",
                "warning"
            );

            return;
        }

        const serviceId =
            serviceIdInput.value;

        const isEditing =
            Boolean(serviceId);

        const originalButtonText =
            saveBtn.textContent;

        saveBtn.disabled = true;

        saveBtn.textContent = isEditing
            ? "Updating..."
            : "Adding...";

        try {
            const response = await fetch(
                isEditing
                    ? `${API}/services/${serviceId}`
                    : `${API}/services`,
                {
                    method:
                        isEditing
                            ? "PUT"
                            : "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                        Authorization:
                            token,
                        Accept:
                            "application/json"
                    },

                    body:
                        JSON.stringify(service)
                }
            );

            const data =
                await readResponse(response);

            notify(
                data.message ||
                (
                    isEditing
                        ? "Service updated successfully."
                        : "Service added successfully."
                ),
                "success"
            );

            resetForm();

            await loadServices();
        } catch (error) {
            console.error(error);

            notify(
                error.message,
                "error"
            );
        } finally {
            saveBtn.disabled = false;

            saveBtn.textContent =
                serviceIdInput.value
                    ? "Update Service"
                    : originalButtonText.includes(
                        "Update"
                    )
                        ? "Update Service"
                        : "Add Service";
        }
    }
);

function startEdit(service) {
    serviceIdInput.value =
        service._id || "";

    nameInput.value =
        service.name || "";

    descriptionInput.value =
        service.description || "";

    categoryInput.value =
        service.category || "";

    priceInput.value =
        service.price ?? "";

    formTitle.textContent =
        "Edit Service";

    saveBtn.textContent =
        "Update Service";

    cancelEditBtn.hidden = false;

    document
        .querySelector(".service-form-panel")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    setTimeout(() => {
        nameInput.focus();
    }, 300);
}

function resetForm() {
    serviceForm.reset();

    serviceIdInput.value = "";

    formTitle.textContent =
        "Add New Service";

    saveBtn.textContent =
        "Add Service";

    cancelEditBtn.hidden = true;
}

cancelEditBtn?.addEventListener(
    "click",
    resetForm
);

async function deleteService(id) {
    if (!id) {
        return;
    }

    const confirmed = window.confirm(
        "Are you sure you want to delete this service?"
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${API}/services/${id}`,
            {
                method: "DELETE",

                headers: {
                    Authorization: token,
                    Accept: "application/json"
                }
            }
        );

        const data =
            await readResponse(response);

        notify(
            data.message ||
            "Service deleted successfully.",
            "success"
        );

        if (
            String(serviceIdInput.value) ===
            String(id)
        ) {
            resetForm();
        }

        await loadServices();
    } catch (error) {
        console.error(error);

        notify(
            error.message,
            "error"
        );
    }
}

loadServices();