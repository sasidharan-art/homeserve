"use strict";

// =====================================================
// API AND AUTHENTICATION
// =====================================================

const API = `${window.location.origin}/api`;

const token = localStorage.getItem("token");
const customerName =
    localStorage.getItem("name") || "Customer";

if (!token) {
    window.location.replace("login.html");
}

// =====================================================
// PAGE ELEMENTS
// =====================================================

const welcome =
    document.getElementById("welcome");

const sidebarUserName =
    document.getElementById("sidebarUserName");

const userAvatar =
    document.getElementById("userAvatar");

const logoutBtn =
    document.getElementById("logoutBtn");

const servicesContainer =
    document.getElementById("services");

const serviceMessage =
    document.getElementById("serviceMessage");

const serviceSearch =
    document.getElementById("serviceSearch");

const heroSearch =
    document.getElementById("heroSearch");

const heroSearchBtn =
    document.getElementById("heroSearchBtn");

const categoryFilters =
    document.getElementById("categoryFilters");

const quickCategories =
    document.getElementById("quickCategories");

const recentSection =
    document.getElementById("recentSection");

const recentServicesContainer =
    document.getElementById("recentServices");

const showFavoritesAction =
    document.getElementById("showFavoritesAction");

const notificationBtn =
    document.getElementById("notificationBtn");

const notificationPanel =
    document.getElementById("notificationPanel");

const themeToggle =
    document.getElementById("themeToggle");

const metricTotalBookings =
    document.getElementById("metricTotalBookings");

const metricActiveBookings =
    document.getElementById("metricActiveBookings");

const metricCompletedBookings =
    document.getElementById("metricCompletedBookings");

const metricTotalSpent =
    document.getElementById("metricTotalSpent");

const upcomingBookingContent =
    document.getElementById("upcomingBookingContent");

const dashboardBookingMessage =
    document.getElementById("dashboardBookingMessage");

const dashboardAverageRating =
    document.getElementById("dashboardAverageRating");

const dashboardReviewCount =
    document.getElementById("dashboardReviewCount");

const reviewAvatarStack =
    document.getElementById("reviewAvatarStack");

const customerTestimonials =
    document.getElementById("customerTestimonials");

// =====================================================
// DASHBOARD STATE
// =====================================================

let allServices = [];

let activeCategory = "All";

let favorites = readStoredArray(
    "favoriteServices"
);

let recentServices = readStoredArray(
    "recentServices"
);

// =====================================================
// LOCAL-STORAGE HELPERS
// =====================================================

function readStoredArray(key) {
    try {
        const value = JSON.parse(
            localStorage.getItem(key) || "[]"
        );

        return Array.isArray(value)
            ? value
            : [];
    } catch (error) {
        console.warn(
            `Unable to read ${key}:`,
            error
        );

        return [];
    }
}

function saveStoredArray(key, value) {
    localStorage.setItem(
        key,
        JSON.stringify(value)
    );
}

// =====================================================
// GENERAL HELPERS
// =====================================================

function safeText(value) {
    return String(value ?? "");
}

function escapeHtml(value) {
    return safeText(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function readJsonResponse(response) {
    const contentType =
        response.headers.get("content-type") || "";

    if (
        !contentType.includes(
            "application/json"
        )
    ) {
        throw new Error(
            `Invalid server response (${response.status})`
        );
    }

    const data = await response.json();

    if (
        !response.ok ||
        data.success === false
    ) {
        throw new Error(
            data.message ||
            `Request failed (${response.status})`
        );
    }

    return data;
}

async function apiGet(
    path,
    authenticated = false
) {
    const headers = {
        Accept: "application/json"
    };

    if (authenticated) {
        headers.Authorization = token;
    }

    const response = await fetch(
        `${API}${path}`,
        {
            method: "GET",
            headers,
            cache: "no-store"
        }
    );

    return readJsonResponse(response);
}

function formatCurrency(value) {
    return `₹${Number(
        value || 0
    ).toLocaleString("en-IN")}`;
}

function formatBookingDate(value) {
    if (!value) {
        return "Date not available";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
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
    ).format(date);
}

function statusClass(status) {
    return safeText(status)
        .toLowerCase()
        .replace(/\s+/g, "-");
}

// =====================================================
// CUSTOMER DETAILS
// =====================================================

function initialiseCustomer() {
    if (welcome) {
        welcome.textContent =
            `Welcome, ${customerName} 👋`;
    }

    if (sidebarUserName) {
        sidebarUserName.textContent =
            customerName;
    }

    if (userAvatar) {
        userAvatar.textContent =
            customerName
                .trim()
                .charAt(0)
                .toUpperCase() || "C";
    }

    logoutBtn?.addEventListener(
        "click",
        () => {
            localStorage.clear();

            window.location.replace(
                "login.html"
            );
        }
    );
}

// =====================================================
// NOTIFICATION PANEL
// =====================================================

function setNotificationOpen(isOpen) {
    if (
        !notificationBtn ||
        !notificationPanel
    ) {
        return;
    }

    notificationPanel.classList.toggle(
        "open",
        isOpen
    );

    notificationBtn.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false"
    );
}

function initialiseNotifications() {
    if (
        !notificationBtn ||
        !notificationPanel
    ) {
        return;
    }

    notificationBtn.type = "button";

    notificationBtn.setAttribute(
        "aria-expanded",
        "false"
    );

    notificationBtn.addEventListener(
        "click",
        (event) => {
            event.preventDefault();
            event.stopPropagation();

            const isOpen =
                notificationPanel
                    .classList
                    .contains("open");

            setNotificationOpen(!isOpen);
        }
    );

    notificationPanel.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();
        }
    );

    document.addEventListener(
        "click",
        () => {
            setNotificationOpen(false);
        }
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape") {
                setNotificationOpen(false);

                notificationBtn.focus();
            }
        }
    );
}

// =====================================================
// THEME
// =====================================================

function applyTheme(theme) {
    document.documentElement.dataset.theme =
        theme;

    if (themeToggle) {
        themeToggle.textContent =
            theme === "dark"
                ? "☀"
                : "☾";
    }

    localStorage.setItem(
        "homeserveTheme",
        theme
    );
}

function initialiseTheme() {
    const savedTheme =
        localStorage.getItem(
            "homeserveTheme"
        ) || "light";

    applyTheme(savedTheme);

    themeToggle?.addEventListener(
        "click",
        () => {
            const currentTheme =
                document.documentElement
                    .dataset.theme;

            applyTheme(
                currentTheme === "dark"
                    ? "light"
                    : "dark"
            );
        }
    );
}

// =====================================================
// SERVICE HELPERS
// =====================================================

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

function getServiceId(service) {
    return String(
        service?._id ||
        service?.id ||
        ""
    );
}

function getServiceIcon(service) {
    const category = safeText(
        service?.category
    ).toLowerCase();

    const name = safeText(
        service?.name
    ).toLowerCase();

    if (name.includes("ac")) {
        return "❄️";
    }

    if (
        name.includes("water tank")
    ) {
        return "💧";
    }

    if (name.includes("pest")) {
        return "🐜";
    }

    if (name.includes("garden")) {
        return "🌿";
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

    return gradients[
        index % gradients.length
    ];
}

function getRatingMarkup(service) {
    const averageRating = Number(
        service?.averageRating || 0
    );

    const reviewCount = Number(
        service?.reviewCount || 0
    );

    if (
        averageRating > 0 &&
        reviewCount > 0
    ) {
        return `
            <span>
                ★ ${averageRating.toFixed(1)}

                <small>
                    (${reviewCount}
                    ${
                        reviewCount === 1
                            ? "review"
                            : "reviews"
                    })
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

// =====================================================
// FAVOURITES AND RECENT SERVICES
// =====================================================

function rememberService(id) {
    if (!id) {
        return;
    }

    recentServices = [
        id,
        ...recentServices.filter(
            (item) =>
                String(item) !== String(id)
        )
    ].slice(0, 4);

    saveStoredArray(
        "recentServices",
        recentServices
    );

    renderRecentServices();
}

function toggleFavorite(id) {
    if (!id) {
        return;
    }

    favorites = favorites.includes(id)
        ? favorites.filter(
            (item) => item !== id
        )
        : [...favorites, id];

    saveStoredArray(
        "favoriteServices",
        favorites
    );

    renderServices();
    renderRecentServices();
}

function bookService(id) {
    if (!id) {
        return;
    }

    rememberService(id);

    localStorage.setItem(
        "serviceId",
        id
    );

    window.location.href =
        "booking.html";
}

// =====================================================
// SERVICE CARD
// =====================================================

function createServiceCard(
    service,
    index,
    compact = false
) {
    const id =
        getServiceId(service);

    const card =
        document.createElement("article");

    card.className = compact
        ? "recent-service-card"
        : "dashboard-service-card reveal-on-scroll";

    card.style.setProperty(
        "--delay",
        `${Math.min(
            index * 70,
            420
        )}ms`
    );

    card.innerHTML = `
        <div
            class="
                service-visual
                ${getGradient(index)}
            "
        >
            <span>
                ${getServiceIcon(service)}
            </span>

            <small>
                ${
                    index < 2
                        ? "POPULAR"
                        : "TRUSTED"
                }
            </small>

            <button
                class="
                    favorite-btn
                    ${
                        favorites.includes(id)
                            ? "active"
                            : ""
                    }
                "
                type="button"
                aria-label="Save service"
            >
                ${
                    favorites.includes(id)
                        ? "♥"
                        : "♡"
                }
            </button>
        </div>

        <div class="service-card-content">
            <div class="service-card-label">
                ${escapeHtml(
                    service.category ||
                    "Home Service"
                )}
            </div>

            <h3>
                ${escapeHtml(
                    service.name ||
                    "Home Service"
                )}
            </h3>

            <p>
                ${escapeHtml(
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
                    <small>
                        Starts from
                    </small>

                    <strong>
                        ${formatCurrency(
                            service.price
                        )}
                    </strong>
                </div>

                <button
                    class="
                        service-btn
                        premium-book-btn
                    "
                    type="button"
                    ${id ? "" : "disabled"}
                >
                    Book now →
                </button>
            </div>
        </div>
    `;

    const favoriteButton =
        card.querySelector(
            ".favorite-btn"
        );

    favoriteButton?.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();

            toggleFavorite(id);
        }
    );

    const bookButton =
        card.querySelector(
            ".premium-book-btn"
        );

    bookButton?.addEventListener(
        "click",
        () => {
            bookService(id);
        }
    );

    card.addEventListener(
        "click",
        (event) => {
            if (
                !event.target.closest(
                    "button"
                )
            ) {
                rememberService(id);
            }
        }
    );

    return card;
}

// =====================================================
// QUICK CATEGORIES
// =====================================================

function renderQuickCategories() {
    if (!quickCategories) {
        return;
    }

    const uniqueCategories = [
        ...new Map(
            allServices
                .filter(
                    (service) =>
                        service.category
                )
                .map(
                    (service) => [
                        service.category,
                        service
                    ]
                )
        ).values()
    ].slice(0, 8);

    quickCategories.innerHTML =
        uniqueCategories
            .map(
                (
                    service,
                    index
                ) => `
                    <button
                        class="
                            quick-category
                            ${getGradient(index)}
                        "
                        data-category="${
                            escapeHtml(
                                service.category
                            )
                        }"
                        type="button"
                    >
                        <i>
                            ${getServiceIcon(
                                service
                            )}
                        </i>

                        <span>
                            ${escapeHtml(
                                service.category
                            )}
                        </span>

                        <small>
                            Explore →
                        </small>
                    </button>
                `
            )
            .join("");

    quickCategories
        .querySelectorAll(
            ".quick-category"
        )
        .forEach((button) => {
            button.addEventListener(
                "click",
                () => {
                    activeCategory =
                        button.dataset
                            .category ||
                        "All";

                    renderFilters();
                    renderServices();

                    document
                        .getElementById(
                            "servicesSection"
                        )
                        ?.scrollIntoView({
                            behavior:
                                "smooth"
                        });
                }
            );
        });
}

// =====================================================
// CATEGORY FILTERS
// =====================================================

function renderFilters() {
    if (!categoryFilters) {
        return;
    }

    const categories = [
        "All",
        ...new Set(
            allServices
                .map(
                    (service) =>
                        safeText(
                            service.category
                        )
                )
                .filter(Boolean)
        )
    ];

    categoryFilters.innerHTML = "";

    categories.forEach(
        (category) => {
            const button =
                document.createElement(
                    "button"
                );

            button.type = "button";

            button.className =
                `category-filter${
                    category ===
                    activeCategory
                        ? " active"
                        : ""
                }`;

            button.textContent =
                category;

            button.addEventListener(
                "click",
                () => {
                    activeCategory =
                        category;

                    renderFilters();
                    renderServices();
                }
            );

            categoryFilters
                .appendChild(button);
        }
    );
}

// =====================================================
// FILTERED SERVICES
// =====================================================

function getFilteredServices() {
    const query = safeText(
        serviceSearch?.value
    )
        .trim()
        .toLowerCase();

    return allServices.filter(
        (service) => {
            const categoryMatches =
                activeCategory === "All" ||
                safeText(
                    service.category
                ) === activeCategory;

            const searchableText = `
                ${service.name || ""}
                ${service.description || ""}
                ${service.category || ""}
            `.toLowerCase();

            return (
                categoryMatches &&
                searchableText.includes(
                    query
                )
            );
        }
    );
}

// =====================================================
// RENDER SERVICES
// =====================================================

function renderServices(
    customServices = null
) {
    if (
        !servicesContainer ||
        !serviceMessage
    ) {
        return;
    }

    const services =
        Array.isArray(customServices)
            ? customServices
            : getFilteredServices();

    servicesContainer.innerHTML = "";

    if (!services.length) {
        serviceMessage.className =
            "page-message service-status empty-state";

        serviceMessage.innerHTML = `
            <strong>
                No matching services found.
            </strong>

            <span>
                Try another search or category.
            </span>
        `;

        return;
    }

    serviceMessage.className =
        "page-message service-status success-state";

    serviceMessage.textContent =
        `${services.length} service${
            services.length === 1
                ? ""
                : "s"
        } available`;

    services.forEach(
        (service, index) => {
            servicesContainer.appendChild(
                createServiceCard(
                    service,
                    index
                )
            );
        }
    );

    requestAnimationFrame(() => {
        servicesContainer
            .querySelectorAll(
                ".dashboard-service-card"
            )
            .forEach((card) => {
                card.classList.add(
                    "revealed"
                );
            });
    });
}

// =====================================================
// RECENT SERVICES
// =====================================================

function renderRecentServices() {
    if (
        !recentSection ||
        !recentServicesContainer
    ) {
        return;
    }

    const services =
        recentServices
            .map((id) =>
                allServices.find(
                    (service) =>
                        getServiceId(
                            service
                        ) ===
                        String(id)
                )
            )
            .filter(Boolean);

    recentSection.hidden =
        services.length === 0;

    recentServicesContainer.innerHTML =
        "";

    services.forEach(
        (service, index) => {
            recentServicesContainer
                .appendChild(
                    createServiceCard(
                        service,
                        index,
                        true
                    )
                );
        }
    );
}

// =====================================================
// LOAD SERVICES
// =====================================================

async function loadServices() {
    if (
        !servicesContainer ||
        !serviceMessage
    ) {
        return;
    }

    serviceMessage.className =
        "page-message service-status loading-state";

    serviceMessage.textContent =
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
        const payload =
            await apiGet(
                "/services"
            );

        allServices =
            Array.isArray(payload)
                ? payload
                : Array.isArray(
                    payload.services
                )
                    ? payload.services
                    : [];

        if (!allServices.length) {
            servicesContainer.innerHTML =
                "";

            serviceMessage.className =
                "page-message service-status empty-state";

            serviceMessage.innerHTML = `
                <strong>
                    No services available.
                </strong>

                <span>
                    Add services from admin management.
                </span>
            `;

            return;
        }

        renderQuickCategories();
        renderFilters();
        renderServices();
        renderRecentServices();
    } catch (error) {
        console.error(
            "Unable to load services:",
            error
        );

        servicesContainer.innerHTML = "";

        serviceMessage.className =
            "page-message service-status error-state";

        serviceMessage.innerHTML = `
            <strong>
                We could not load services.
            </strong>

            <span>
                ${escapeHtml(
                    error.message
                )}
            </span>

            <button
                type="button"
                id="retryServices"
            >
                Try again
            </button>
        `;

        document
            .getElementById(
                "retryServices"
            )
            ?.addEventListener(
                "click",
                loadServices
            );
    }
}

// =====================================================
// SEARCH AND FAVOURITES
// =====================================================

function initialiseSearch() {
    serviceSearch?.addEventListener(
        "input",
        () => {
            renderServices();
        }
    );

    heroSearchBtn?.addEventListener(
        "click",
        () => {
            if (
                !serviceSearch ||
                !heroSearch
            ) {
                return;
            }

            serviceSearch.value =
                heroSearch.value;

            renderServices();

            document
                .getElementById(
                    "servicesSection"
                )
                ?.scrollIntoView({
                    behavior: "smooth"
                });
        }
    );

    heroSearch?.addEventListener(
        "keydown",
        (event) => {
            if (
                event.key === "Enter"
            ) {
                event.preventDefault();

                heroSearchBtn?.click();
            }
        }
    );

    showFavoritesAction
        ?.addEventListener(
            "click",
            () => {
                activeCategory =
                    "All";

                renderFilters();

                if (serviceSearch) {
                    serviceSearch.value =
                        "";
                }

                const savedServices =
                    allServices.filter(
                        (service) =>
                            favorites.includes(
                                getServiceId(
                                    service
                                )
                            )
                    );

                renderServices(
                    savedServices
                );

                document
                    .getElementById(
                        "servicesSection"
                    )
                    ?.scrollIntoView({
                        behavior:
                            "smooth"
                    });
            }
        );
}

// =====================================================
// BOOKING OVERVIEW
// =====================================================

function renderBookingOverview(
    bookings
) {
    const items =
        Array.isArray(bookings)
            ? bookings
            : [];

    const activeBookings =
        items.filter(
            (booking) =>
                ![
                    "Completed",
                    "Cancelled"
                ].includes(
                    booking.status
                )
        );

    const completedBookings =
        items.filter(
            (booking) =>
                booking.status ===
                "Completed"
        );

    const totalSpent =
        completedBookings.reduce(
            (
                total,
                booking
            ) =>
                total +
                Number(
                    booking.pricing
                        ?.total || 0
                ),
            0
        );

    if (metricTotalBookings) {
        metricTotalBookings.textContent =
            items.length;
    }

    if (metricActiveBookings) {
        metricActiveBookings.textContent =
            activeBookings.length;
    }

    if (
        metricCompletedBookings
    ) {
        metricCompletedBookings
            .textContent =
            completedBookings.length;
    }

    if (metricTotalSpent) {
        metricTotalSpent.textContent =
            formatCurrency(totalSpent);
    }

    if (!upcomingBookingContent) {
        return;
    }

    const now = new Date();

    const nextBooking =
        activeBookings
            .filter((booking) => {
                const date =
                    new Date(
                        booking.bookingDate
                    );

                return (
                    !Number.isNaN(
                        date.getTime()
                    ) &&
                    date >= now
                );
            })
            .sort(
                (
                    first,
                    second
                ) =>
                    new Date(
                        first.bookingDate
                    ) -
                    new Date(
                        second.bookingDate
                    )
            )[0] ||
        activeBookings[0];

    if (!nextBooking) {
        upcomingBookingContent
            .innerHTML = `
                <div class="no-upcoming-booking">
                    <i>⌂</i>

                    <h4>
                        No upcoming booking
                    </h4>

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

    const providerName =
        nextBooking.provider?.name ||
        "Provider will be assigned soon";

    upcomingBookingContent.innerHTML = `
        <div class="upcoming-service-row">
            <div class="upcoming-service-icon">
                ${getServiceIcon(
                    nextBooking.service || {}
                )}
            </div>

            <div>
                <span>
                    ${escapeHtml(
                        nextBooking.bookingCode ||
                        "HomeServe booking"
                    )}
                </span>

                <h4>
                    ${escapeHtml(
                        nextBooking.service
                            ?.name ||
                        "Home Service"
                    )}
                </h4>

                <p>
                    ${formatBookingDate(
                        nextBooking.bookingDate
                    )}
                    ·
                    ${escapeHtml(
                        nextBooking.timeSlot ||
                        ""
                    )}
                </p>
            </div>

            <b
                class="
                    booking-status-pill
                    ${statusClass(
                        nextBooking.status
                    )}
                "
            >
                ${escapeHtml(
                    nextBooking.status ||
                    "Pending"
                )}
            </b>
        </div>

        <div class="upcoming-details">
            <div>
                <small>
                    Professional
                </small>

                <strong>
                    ${escapeHtml(
                        providerName
                    )}
                </strong>
            </div>

            <div>
                <small>
                    Service total
                </small>

                <strong>
                    ${formatCurrency(
                        nextBooking.pricing
                            ?.total
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
                    ].includes(
                        nextBooking.status
                    )
                        ? "active"
                        : ""
                }"
            ></span>

            <span
                class="${
                    [
                        "On the Way",
                        "Completed"
                    ].includes(
                        nextBooking.status
                    )
                        ? "active"
                        : ""
                }"
            ></span>

            <span
                class="${
                    nextBooking.status ===
                    "Completed"
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

async function loadBookingOverview() {
    try {
        const bookings =
            await apiGet(
                "/bookings",
                true
            );

        renderBookingOverview(
            bookings
        );

        if (
            dashboardBookingMessage
        ) {
            dashboardBookingMessage
                .textContent = "";
        }
    } catch (error) {
        console.error(
            "Unable to load bookings:",
            error
        );

        renderBookingOverview([]);

        if (
            dashboardBookingMessage
        ) {
            dashboardBookingMessage
                .textContent =
                "Booking overview could not be loaded. Your services are still available below.";
        }
    }
}

// =====================================================
// CUSTOMER REVIEWS
// =====================================================

function renderStars(rating) {
    const roundedRating =
        Math.max(
            0,
            Math.min(
                5,
                Math.round(
                    Number(rating) || 0
                )
            )
        );

    return (
        "★".repeat(roundedRating) +
        "☆".repeat(
            5 - roundedRating
        )
    );
}

async function loadCustomerReviews() {
    try {
        const data =
            await apiGet(
                "/reviews/public"
            );

        const reviews =
            Array.isArray(
                data.reviews
            )
                ? data.reviews
                : [];

        const reviewCount =
            Number(data.count || 0);

        const averageRating =
            Number(data.average || 0);

        if (
            dashboardAverageRating
        ) {
            dashboardAverageRating
                .textContent =
                reviewCount > 0
                    ? `${averageRating.toFixed(
                        1
                    )}/5 customer rating`
                    : "No customer ratings yet";
        }

        if (
            dashboardReviewCount
        ) {
            dashboardReviewCount
                .textContent =
                reviewCount > 0
                    ? `${reviewCount} verified customer review${
                        reviewCount === 1
                            ? ""
                            : "s"
                    }`
                    : "Reviews from completed bookings";
        }

        if (reviewAvatarStack) {
            reviewAvatarStack.innerHTML =
                reviews
                    .slice(0, 3)
                    .map((review) => {
                        const initial =
                            safeText(
                                review
                                    .customer
                                    ?.name ||
                                "Customer"
                            )
                                .charAt(0)
                                .toUpperCase();

                        return `
                            <i>
                                ${escapeHtml(
                                    initial
                                )}
                            </i>
                        `;
                    })
                    .join("");
        }

        if (!customerTestimonials) {
            return;
        }

        if (!reviews.length) {
            customerTestimonials
                .innerHTML = `
                    <article>
                        <div>
                            ☆☆☆☆☆
                        </div>

                        <p>
                            No customer reviews yet.
                        </p>

                        <footer>
                            <b>HomeServe</b>

                            <span>
                                Reviews will appear after completed bookings.
                            </span>
                        </footer>
                    </article>
                `;

            return;
        }

        customerTestimonials.innerHTML =
            reviews
                .slice(0, 6)
                .map((review) => {
                    const customer =
                        review.customer
                            ?.name ||
                        "Customer";

                    const service =
                        review.service
                            ?.name ||
                        "Home service";

                    const comment =
                        review.comment ||
                        "Customer submitted a rating.";

                    return `
                        <article>
                            <div>
                                ${renderStars(
                                    review.rating
                                )}
                            </div>

                            <p>
                                “${escapeHtml(
                                    comment
                                )}”
                            </p>

                            <footer>
                                <b>
                                    ${escapeHtml(
                                        customer
                                    )}
                                </b>

                                <span>
                                    ${escapeHtml(
                                        service
                                    )}
                                </span>
                            </footer>
                        </article>
                    `;
                })
                .join("");
    } catch (error) {
        console.error(
            "Unable to load customer reviews:",
            error
        );

        if (
            dashboardAverageRating
        ) {
            dashboardAverageRating
                .textContent =
                "No customer ratings yet";
        }

        if (
            dashboardReviewCount
        ) {
            dashboardReviewCount
                .textContent =
                "Reviews from completed bookings";
        }

        if (customerTestimonials) {
            customerTestimonials
                .innerHTML = `
                    <article>
                        <p>
                            Customer reviews could not be loaded.
                        </p>
                    </article>
                `;
        }
    }
}

// =====================================================
// NUMBER COUNTERS
// =====================================================

function initialiseCounters() {
    const counters =
        document.querySelectorAll(
            "[data-count]"
        );

    if (
        !(
            "IntersectionObserver" in
            window
        )
    ) {
        counters.forEach(
            (element) => {
                const target =
                    Number(
                        element.dataset
                            .count || 0
                    );

                element.textContent =
                    target.toLocaleString(
                        "en-IN"
                    );
            }
        );

        return;
    }

    const observer =
        new IntersectionObserver(
            (entries) => {
                entries.forEach(
                    (entry) => {
                        if (
                            !entry.isIntersecting
                        ) {
                            return;
                        }

                        const element =
                            entry.target;

                        const target =
                            Number(
                                element
                                    .dataset
                                    .count || 0
                            );

                        let current = 0;

                        const step =
                            Math.max(
                                1,
                                Math.ceil(
                                    target /
                                    55
                                )
                            );

                        function update() {
                            current =
                                Math.min(
                                    target,
                                    current +
                                    step
                                );

                            element
                                .textContent =
                                target >= 1000
                                    ? `${current.toLocaleString(
                                        "en-IN"
                                    )}+`
                                    : current.toLocaleString(
                                        "en-IN"
                                    );

                            if (
                                current <
                                target
                            ) {
                                requestAnimationFrame(
                                    update
                                );
                            }
                        }

                        update();

                        observer.unobserve(
                            element
                        );
                    }
                );
            },
            {
                threshold: 0.5
            }
        );

    counters.forEach(
        (element) => {
            observer.observe(element);
        }
    );
}

// =====================================================
// SOCKET.IO UPDATES
// =====================================================

function initialiseSocketUpdates() {
    if (!window.io) {
        return;
    }

    try {
        const socket =
            window.socket ||
            window.io();

        socket.on(
            "review-updated",
            () => {
                loadServices();
                loadCustomerReviews();
            }
        );

        socket.on(
            "booking-updated",
            () => {
                loadBookingOverview();
            }
        );
    } catch (error) {
        console.warn(
            "Real-time updates are unavailable:",
            error
        );
    }
}

// =====================================================
// INITIALISE DASHBOARD
// =====================================================

async function initialiseDashboard() {
    initialiseCustomer();

    initialiseNotifications();

    initialiseTheme();

    initialiseSearch();

    initialiseCounters();

    await Promise.allSettled([
        loadServices(),
        loadBookingOverview(),
        loadCustomerReviews()
    ]);

    initialiseSocketUpdates();
}

if (
    document.readyState ===
    "loading"
) {
    document.addEventListener(
        "DOMContentLoaded",
        initialiseDashboard
    );
} else {
    initialiseDashboard();
}