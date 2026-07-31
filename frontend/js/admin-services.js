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

if (!token || role !== "admin") {
    window.location.href = "login.html";
}

document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.clear();
    window.location.href = "login.html";
});

async function readResponse(response) {
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "Request failed");
    }

    return data;
}

async function loadServices() {

    const list = document.getElementById("serviceList");
    const message = document.getElementById("serviceMessage");

    list.innerHTML = "";
    message.textContent = "Loading services...";

    try {

        const response = await fetch(`${API}/services`, {
            headers: {
                Authorization: token
            }
        });

        const services = await readResponse(response);

        message.textContent = "";

        if (services.length === 0) {
            message.textContent = "No services available.";
            return;
        }

        services.forEach((service) => {

            const card = document.createElement("div");
            card.className = "booking-card";

            const title = document.createElement("h3");
            title.textContent = service.name;

            const description = document.createElement("p");
            description.textContent = service.description;

            const category = document.createElement("p");
            category.innerHTML =
                `<strong>Category:</strong> ${escapeHtml(service.category)}`;

            const price = document.createElement("p");
            price.innerHTML =
                `<strong>Price:</strong> ₹${Number(service.price).toFixed(2)}`;

            const actions = document.createElement("div");
            actions.className = "provider-actions";

            const editButton = document.createElement("button");
            editButton.className = "complete-btn";
            editButton.textContent = "Edit";
            editButton.addEventListener("click", () => {
                startEdit(service);
            });

            const deleteButton = document.createElement("button");
            deleteButton.className = "cancel-btn";
            deleteButton.textContent = "Delete";
            deleteButton.addEventListener("click", () => {
                deleteService(service._id);
            });

            actions.append(editButton, deleteButton);

            card.append(
                title,
                description,
                category,
                price,
                actions
            );

            list.appendChild(card);

        });

    } catch (error) {

        console.error(error);
        message.textContent = error.message;

    }

}

serviceForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const service = {
        name: nameInput.value.trim(),
        description: descriptionInput.value.trim(),
        category: categoryInput.value.trim(),
        price: Number(priceInput.value)
    };

    if (
        !service.name ||
        !service.description ||
        !service.category ||
        Number.isNaN(service.price) ||
        service.price < 0
    ) {
        notify("Enter valid service details.", "warning");
        return;
    }

    const serviceId = serviceIdInput.value;
    const isEditing = Boolean(serviceId);

    try {

        const response = await fetch(
            isEditing
                ? `${API}/services/${serviceId}`
                : `${API}/services`,
            {
                method: isEditing ? "PUT" : "POST",

                headers: {
                    "Content-Type": "application/json",
                    Authorization: token
                },

                body: JSON.stringify(service)
            }
        );

        const data = await readResponse(response);

        notify(data.message, response.ok ? "success" : "error");

        resetForm();
        await loadServices();

    } catch (error) {

        console.error(error);
        notify(error.message, "error");

    }

});

function startEdit(service) {

    serviceIdInput.value = service._id;
    nameInput.value = service.name;
    descriptionInput.value = service.description;
    categoryInput.value = service.category;
    priceInput.value = service.price;

    formTitle.textContent = "Edit Service";
    saveBtn.textContent = "Update Service";
    cancelEditBtn.hidden = false;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

}

function resetForm() {

    serviceForm.reset();

    serviceIdInput.value = "";

    formTitle.textContent = "Add New Service";
    saveBtn.textContent = "Add Service";
    cancelEditBtn.hidden = true;

}

cancelEditBtn.addEventListener("click", resetForm);

async function deleteService(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this service?"
    );

    if (!confirmed) {
        return;
    }

    try {

        const response = await fetch(`${API}/services/${id}`, {
            method: "DELETE",

            headers: {
                Authorization: token
            }
        });

        const data = await readResponse(response);

        notify(data.message, response.ok ? "success" : "error");

        if (serviceIdInput.value === id) {
            resetForm();
        }

        await loadServices();

    } catch (error) {

        console.error(error);
        notify(error.message, "error");

    }

}

function escapeHtml(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}

loadServices();