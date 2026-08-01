const API = `${window.location.origin}/api`;

const token = localStorage.getItem("token");
const customerName = localStorage.getItem("name") || "Customer";

if (!token) {
    window.location.href = "login.html";
}

const welcome = document.getElementById("welcome");
const servicesContainer = document.getElementById("services");
const messageBox = document.getElementById("serviceMessage");
const searchInput = document.getElementById("serviceSearch");
const heroSearch = document.getElementById("heroSearch");
const filterContainer = document.getElementById("categoryFilters");

let allServices = [];
let activeCategory = "All";

let favorites = JSON.parse(
    localStorage.getItem("favoriteServices") || "[]"
);

let recent = JSON.parse(
    localStorage.getItem("recentServices") || "[]"
);

// ===================================
// Customer details
// ===================================

if (welcome) {
    welcome.textContent = `Welcome, ${customerName} 👋`;
}

const sidebarUserName = document.getElementById("sidebarUserName");

if (sidebarUserName) {
    sidebarUserName.textContent = customerName;
}

const userAvatar = document.getElementById("userAvatar");

if (userAvatar) {
    userAvatar.textContent = customerName
        .charAt(0)
        .toUpperCase();
}

document
    .getElementById("logoutBtn")
    ?.addEventListener("click", () => {
        localStorage.clear();
        window.location.href = "login.html";
    });

// ===================================
// Service helpers
// ===================================

const serviceIcons = {
    appliance: "🧰",
    woodwork: "🪚",
    carpentry: "🪚",
    electrical: "⚡",
    outdoor: "🌿",
    cleaning: "✨",
    painting: "🎨",
    plumbing: "🔧"
};

function safeText(value) {
    return String(value ?? "");
}

function serviceId(service) {
    return service._id || service.id;
}

function getIcon(service) {
    const category = safeText(service.category).toLowerCase();
    const name = safeText(service.name).toLowerCase();

    if (name.includes("ac")) {
        return "❄️";
    }

    if (name.includes("water tank")) {
        return "💧";
    }

    return serviceIcons[category] || "🏠";
}

function getGradient(index) {
    const gradients = [
        "service-blue",
        "service-cyan",
        "service-emerald",
        "service-amber"
    ];

    return gradients[index % gradients.length];
}

// ===================================
// Quick categories
// ===================================

function renderQuickCategories() {
    const quickCategories =
        document.getElementById("quickCategories");

    if (!quickCategories) {
        return;
    }

    const categories = [
        ...new Map(
            allServices.map((service) => [
                safeText(service.category),
                service
            ])
        ).values()
    ].slice(0, 8);

    quickCategories.innerHTML = categories
        .map(
            (service, index) => `
                <button
                    class="quick-category ${getGradient(index)}"
                    data-category="${safeText(service.category)}"
                    type="button"
                >
                    <i>${getIcon(service)}</i>
                    <span>${safeText(service.category)}</span>
                    <small>Explore →</small>
                </button>
            `
        )
        .join("");

    document
        .querySelectorAll(".quick-category")
        .forEach((button) => {
            button.addEventListener("click", () => {
                activeCategory = button.dataset.category;

                renderFilters();
                renderServices();

                document
                    .getElementById("servicesSection")
                    ?.scrollIntoView({
                        behavior: "smooth"
                    });
            });
        });
}

// ===================================
// Category filters
// ===================================

function renderFilters() {
    if (!filterContainer) {
        return;
    }

    const categories = [
        "All",
        ...new Set(
            allServices
                .map((service) =>
                    safeText(service.category)
                )
                .filter(Boolean)
        )
    ];

    filterContainer.innerHTML = "";

    categories.forEach((category) => {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
            `category-filter${
                category === activeCategory
                    ? " active"
                    : ""
            }`;

        button.textContent = category;

        button.addEventListener("click", () => {
            activeCategory = category;

            renderFilters();
            renderServices();
        });

        filterContainer.appendChild(button);
    });
}

// ===================================
// Favorites
// ===================================

function toggleFavorite(id) {
    favorites = favorites.includes(id)
        ? favorites.filter((item) => item !== id)
        : [...favorites, id];

    localStorage.setItem(
        "favoriteServices",
        JSON.stringify(favorites)
    );

    renderServices();
    renderRecent();
}

// ===================================
// Recently viewed services
// ===================================

function rememberService(id) {
    recent = [
        id,
        ...recent.filter((item) => item !== id)
    ].slice(0, 4);

    localStorage.setItem(
        "recentServices",
        JSON.stringify(recent)
    );

    renderRecent();
}

// ===================================
// Book service
// ===================================

function bookService(id) {
    if (!id) {
        return;
    }

    rememberService(id);

    localStorage.setItem("serviceId", id);

    window.location.href = "booking.html";
}

// ===================================
// Real customer rating display
// ===================================

function getRatingMarkup(service) {
    /*
     * No default rating is displayed.
     *
     * If your backend later supplies these fields:
     * service.averageRating
     * service.reviewCount
     *
     * actual customer ratings will appear automatically.
     */

    const averageRating =
        Number(service.averageRating || 0);

    const reviewCount =
        Number(service.reviewCount || 0);

    if (averageRating > 0 && reviewCount > 0) {
        return `
            <span>
                ★ ${averageRating.toFixed(1)}
                <small>
                    (${reviewCount}
                    ${reviewCount === 1
                        ? " review"
                        : " reviews"})
                </small>
            </span>
        `;
    }

    return `
        <span>
            No customer ratings yet
        </span>
    `;
}

// ===================================
// Create service card
// ===================================

function createServiceCard(
    service,
    index,
    compact = false
) {
    const id = serviceId(service);

    const card = document.createElement("article");

    card.className = compact
        ? "recent-service-card"
        : "dashboard-service-card reveal-on-scroll";

    card.style.setProperty(
        "--delay",
        `${Math.min(index * 70, 420)}ms`
    );

    card.innerHTML = `
        <div class="service-visual ${getGradient(index)}">
            <span>${getIcon(service)}</span>

            <small>
                ${index < 2 ? "POPULAR" : "TRUSTED"}
            </small>

            <button
                class="favorite-btn ${
                    favorites.includes(id)
                        ? "active"
                        : ""
                }"
                type="button"
                aria-label="Save service"
            >
                ${favorites.includes(id) ? "♥" : "♡"}
            </button>
        </div>

        <div class="service-card-content">
            <div class="service-card-label">
                ${safeText(
                    service.category || "Home Service"
                )}
            </div>

            <h3>
                ${safeText(
                    service.name || "Home Service"
                )}
            </h3>

            <p>
                ${safeText(
                    service.description ||
                    "Professional doorstep service from a trusted expert."
                )}
            </p>

            <div class="service-card-meta">
                ${getRatingMarkup(service)}

                <span>
                    ✓ Verified professional
                </span>

                <span>
                    ⏱ 45–60 min
                </span>
            </div>

            <div class="service-card-bottom">
                <div class="service-price">
                    <small>Starts from</small>

                    <strong>
                        ₹${Number(
                            service.price || 0
                        ).toLocaleString("en-IN")}
                    </strong>
                </div>

                <button
                    class="service-btn premium-book-btn"
                    type="button"
                    ${!id ? "disabled" : ""}
                >
                    Book now →
                </button>
            </div>
        </div>
    `;

    card
        .querySelector(".favorite-btn")
        ?.addEventListener("click", (event) => {
            event.stopPropagation();
            toggleFavorite(id);
        });

    card
        .querySelector(".premium-book-btn")
        ?.addEventListener("click", () => {
            bookService(id);
        });

    card.addEventListener("click", (event) => {
        if (!event.target.closest("button")) {
            rememberService(id);
        }
    });

    return card;
}

// ===================================
// Render services
// ===================================

function renderServices() {
    if (
        !servicesContainer ||
        !messageBox ||
        !searchInput
    ) {
        return;
    }

    const query = searchInput.value
        .trim()
        .toLowerCase();

    const filtered = allServices.filter((service) => {
        const matchesCategory =
            activeCategory === "All" ||
            service.category === activeCategory;

        const searchableText = `
            ${service.name || ""}
            ${service.description || ""}
            ${service.category || ""}
        `.toLowerCase();

        return (
            matchesCategory &&
            searchableText.includes(query)
        );
    });

    servicesContainer.innerHTML = "";

    if (!filtered.length) {
        messageBox.className =
            "page-message service-status empty-state";

        messageBox.innerHTML = `
            <strong>No matching services found.</strong>
            <span>Try another search or category.</span>
        `;

        return;
    }

    messageBox.textContent =
        `${filtered.length} service${
            filtered.length === 1 ? "" : "s"
        } available`;

    messageBox.className =
        "page-message service-status success-state";

    filtered.forEach((service, index) => {
        servicesContainer.appendChild(
            createServiceCard(service, index)
        );
    });

    requestAnimationFrame(() => {
        document
            .querySelectorAll(
                ".dashboard-service-card"
            )
            .forEach((card) => {
                card.classList.add("revealed");
            });
    });
}

// ===================================
// Recent services
// ===================================

function renderRecent() {
    const section =
        document.getElementById("recentSection");

    const container =
        document.getElementById("recentServices");

    if (!section || !container) {
        return;
    }

    const items = recent
        .map((id) =>
            allServices.find(
                (service) =>
                    serviceId(service) === id
            )
        )
        .filter(Boolean);

    section.hidden = !items.length;
    container.innerHTML = "";

    items.forEach((service, index) => {
        container.appendChild(
            createServiceCard(
                service,
                index,
                true
            )
        );
    });
}

// ===================================
// Load services
// ===================================

async function loadServices() {
    if (!messageBox || !servicesContainer) {
        return;
    }

    messageBox.className =
        "page-message service-status loading-state";

    messageBox.textContent =
        "Loading available services...";

    servicesContainer.innerHTML =
        Array.from(
            { length: 6 },
            () => `
                <div class="service-skeleton">
                    <i></i>
                    <b></b>
                    <span></span>
                    <span></span>
                </div>
            `
        ).join("");

    try {
        const response = await fetch(
            `${API}/services`,
            {
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Service request failed (${response.status})`
            );
        }

        const payload = await response.json();

        allServices = Array.isArray(payload)
            ? payload
            : Array.isArray(payload.services)
                ? payload.services
                : [];

        if (!allServices.length) {
            servicesContainer.innerHTML = "";

            messageBox.className =
                "page-message service-status empty-state";

            messageBox.innerHTML = `
                <strong>No services available.</strong>
                <span>
                    Add services from admin management.
                </span>
            `;

            return;
        }

        renderQuickCategories();
        renderFilters();
        renderServices();
        renderRecent();
    } catch (error) {
        console.error(error);

        servicesContainer.innerHTML = "";

        messageBox.className =
            "page-message service-status error-state";

        messageBox.innerHTML = `
            <strong>
                We could not load services.
            </strong>

            <span>
                ${safeText(error.message)}
            </span>

            <button
                type="button"
                id="retryServices"
            >
                Try again
            </button>
        `;

        document
            .getElementById("retryServices")
            ?.addEventListener(
                "click",
                loadServices
            );
    }
}

// ===================================
// Search
// ===================================

searchInput?.addEventListener(
    "input",
    renderServices
);

document
    .getElementById("heroSearchBtn")
    ?.addEventListener("click", () => {
        if (!searchInput || !heroSearch) {
            return;
        }

        searchInput.value = heroSearch.value;

        renderServices();

        document
            .getElementById("servicesSection")
            ?.scrollIntoView({
                behavior: "smooth"
            });
    });

heroSearch?.addEventListener(
    "keydown",
    (event) => {
        if (event.key === "Enter") {
            document
                .getElementById("heroSearchBtn")
                ?.click();
        }
    }
);

// ===================================
// Notification panel
// ===================================

const notificationBtn =
    document.getElementById("notificationBtn");

const notificationPanel =
    document.getElementById("notificationPanel");

notificationBtn?.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();

        notificationPanel
            ?.classList
            .toggle("open");
    }
);

document.addEventListener("click", () => {
    notificationPanel
        ?.classList
        .remove("open");
});

notificationPanel?.addEventListener(
    "click",
    (event) => {
        event.stopPropagation();
    }
);

// ===================================
// Theme
// ===================================

const themeToggle =
    document.getElementById("themeToggle");

function applyTheme(theme) {
    document.documentElement.dataset.theme =
        theme;

    if (themeToggle) {
        themeToggle.textContent =
            theme === "dark" ? "☀" : "☾";
    }

    localStorage.setItem(
        "homeserveTheme",
        theme
    );
}

applyTheme(
    localStorage.getItem("homeserveTheme") ||
    "light"
);

themeToggle?.addEventListener(
    "click",
    () => {
        const currentTheme =
            document.documentElement.dataset.theme;

        applyTheme(
            currentTheme === "dark"
                ? "light"
                : "dark"
        );
    }
);

// ===================================
// Number counters
// Fake rating counter removed
// ===================================

const counterObserver =
    new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) {
                    return;
                }

                const element = entry.target;
                const target = Number(
                    element.dataset.count
                );

                if (!Number.isFinite(target)) {
                    return;
                }

                let current = 0;

                const increase =
                    Math.max(
                        1,
                        Math.ceil(target / 55)
                    );

                function updateCounter() {
                    current += increase;

                    if (current > target) {
                        current = target;
                    }

                    element.textContent =
                        target >= 1000
                            ? `${current.toLocaleString(
                                "en-IN"
                            )}+`
                            : current.toLocaleString(
                                "en-IN"
                            );

                    if (current < target) {
                        requestAnimationFrame(
                            updateCounter
                        );
                    }
                }

                updateCounter();

                counterObserver.unobserve(
                    element
                );
            });
        },
        {
            threshold: 0.5
        }
    );

document
    .querySelectorAll("[data-count]")
    .forEach((element) => {
        counterObserver.observe(element);
    });

// ===================================
// Booking helpers
// ===================================

function formatCurrency(value) {
    return `₹${Number(
        value || 0
    ).toLocaleString("en-IN")}`;
}

function formatBookingDate(value) {
    if (!value) {
        return "Date not available";
    }

    return new Intl.DateTimeFormat(
        "en-IN",
        {
            weekday: "short",
            day: "numeric",
            month: "short",
            year: "numeric"
        }
    ).format(new Date(value));
}

function statusClass(status) {
    return safeText(status)
        .toLowerCase()
        .replace(/\s+/g, "-");
}

// ===================================
// Booking overview
// ===================================

function renderBookingOverview(bookings) {
    const items =
        Array.isArray(bookings)
            ? bookings
            : [];

    const active = items.filter(
        (booking) =>
            ![
                "Completed",
                "Cancelled"
            ].includes(booking.status)
    );

    const completed = items.filter(
        (booking) =>
            booking.status === "Completed"
    );

    const totalSpent = completed.reduce(
        (sum, booking) =>
            sum +
            Number(
                booking.pricing?.total || 0
            ),
        0
    );

    const totalBookings =
        document.getElementById(
            "metricTotalBookings"
        );

    const activeBookings =
        document.getElementById(
            "metricActiveBookings"
        );

    const completedBookings =
        document.getElementById(
            "metricCompletedBookings"
        );

    const totalSpentElement =
        document.getElementById(
            "metricTotalSpent"
        );

    if (totalBookings) {
        totalBookings.textContent =
            items.length;
    }

    if (activeBookings) {
        activeBookings.textContent =
            active.length;
    }

    if (completedBookings) {
        completedBookings.textContent =
            completed.length;
    }

    if (totalSpentElement) {
        totalSpentElement.textContent =
            formatCurrency(totalSpent);
    }

    const now = new Date();

    const next = active
        .filter(
            (booking) =>
                new Date(
                    booking.bookingDate
                ) >= now
        )
        .sort(
            (first, second) =>
                new Date(
                    first.bookingDate
                ) -
                new Date(
                    second.bookingDate
                )
        )[0];

    const box =
        document.getElementById(
            "upcomingBookingContent"
        );

    if (!box) {
        return;
    }

    if (!next) {
        box.innerHTML = `
            <div class="no-upcoming-booking">
                <i>⌂</i>

                <h4>No upcoming booking</h4>

                <p>
                    Your next home-service request
                    will appear here.
                </p>

                <a
                    class="btn btn-primary"
                    href="#servicesSection"
                >
                    Book now
                </a>
            </div>
        `;

        return;
    }

    const name = safeText(
        next.service?.name || "Home Service"
    );

    const provider = safeText(
        next.provider?.name ||
        "Provider will be assigned soon"
    );

    box.innerHTML = `
        <div class="upcoming-service-row">
            <div class="upcoming-service-icon">
                ${getIcon(next.service || {})}
            </div>

            <div>
                <span>
                    ${safeText(
                        next.bookingCode ||
                        "HomeServe booking"
                    )}
                </span>

                <h4>${name}</h4>

                <p>
                    ${formatBookingDate(
                        next.bookingDate
                    )}
                    ·
                    ${safeText(
                        next.timeSlot || ""
                    )}
                </p>
            </div>

            <b
                class="
                    booking-status-pill
                    ${statusClass(next.status)}
                "
            >
                ${safeText(
                    next.status || "Pending"
                )}
            </b>
        </div>

        <div class="upcoming-details">
            <div>
                <small>Professional</small>
                <strong>${provider}</strong>
            </div>

            <div>
                <small>Service total</small>

                <strong>
                    ${formatCurrency(
                        next.pricing?.total
                    )}
                </strong>
            </div>
        </div>

        <div class="booking-progress-line">
            <span class="active"></span>

            <span
                class="${
                    [
                        "Accepted",
                        "On the Way",
                        "Completed"
                    ].includes(next.status)
                        ? "active"
                        : ""
                }"
            ></span>

            <span
                class="${
                    [
                        "On the Way",
                        "Completed"
                    ].includes(next.status)
                        ? "active"
                        : ""
                }"
            ></span>

            <span
                class="${
                    next.status === "Completed"
                        ? "active"
                        : ""
                }"
            ></span>
        </div>

        <div class="booking-progress-labels">
            <span>Created</span>
            <span>Accepted</span>
            <span>On the way</span>
            <span>Completed</span>
        </div>
    `;
}

// ===================================
// Load booking overview
// ===================================

async function loadBookingOverview() {
    const message =
        document.getElementById(
            "dashboardBookingMessage"
        );

    try {
        const response = await fetch(
            `${API}/bookings`,
            {
                headers: {
                    Authorization: token,
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        const payload =
            await response.json();

        if (!response.ok) {
            throw new Error(
                payload.message ||
                "Unable to load booking overview"
            );
        }

        renderBookingOverview(payload);

        if (message) {
            message.textContent = "";
        }
    } catch (error) {
        console.error(error);

        renderBookingOverview([]);

        if (message) {
            message.textContent =
                "Booking overview could not be loaded. Your services are still available below.";
        }
    }
}

// ===================================
// Show favorites
// ===================================

document
    .getElementById("showFavoritesAction")
    ?.addEventListener("click", () => {
        const favoriteSet =
            new Set(favorites);

        activeCategory = "All";

        renderFilters();

        if (searchInput) {
            searchInput.value = "";
        }

        servicesContainer.innerHTML = "";

        const saved = allServices.filter(
            (service) =>
                favoriteSet.has(
                    serviceId(service)
                )
        );

        if (!saved.length) {
            messageBox.className =
                "page-message service-status empty-state";

            messageBox.innerHTML = `
                <strong>
                    No saved services yet.
                </strong>

                <span>
                    Tap the heart icon on a
                    service card to save it.
                </span>
            `;
        } else {
            messageBox.className =
                "page-message service-status success-state";

            messageBox.textContent =
                `${saved.length} saved service${
                    saved.length === 1
                        ? ""
                        : "s"
                }`;

            saved.forEach(
                (service, index) => {
                    servicesContainer.appendChild(
                        createServiceCard(
                            service,
                            index
                        )
                    );
                }
            );
        }

        document
            .getElementById("servicesSection")
            ?.scrollIntoView({
                behavior: "smooth"
            });
    });

// ===================================
// Initial loading
// ===================================

loadServices();
loadBookingOverview();