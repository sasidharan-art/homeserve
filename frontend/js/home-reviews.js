"use strict";

const HOME_REVIEW_API =
    `${window.location.origin}/api/reviews/public`;

function escapeHomeReviewHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function loadHomeReviewSummary() {
    const averageElement =
        document.getElementById(
            "homeAverageRating"
        );

    const countElement =
        document.getElementById(
            "homeReviewCount"
        );

    if (!averageElement || !countElement) {
        return;
    }

    try {
        const response = await fetch(
            HOME_REVIEW_API,
            {
                headers: {
                    Accept: "application/json"
                },
                cache: "no-store"
            }
        );

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(
                data.message ||
                "Unable to load ratings"
            );
        }

        if (data.count > 0) {
            averageElement.textContent =
                `★ ${Number(
                    data.average
                ).toFixed(1)}/5`;

            countElement.textContent =
                `${data.count} customer review${
                    data.count === 1 ? "" : "s"
                }`;
        } else {
            averageElement.textContent =
                "No ratings yet";

            countElement.textContent =
                "Customer reviews";
        }
    } catch (error) {
        console.error(error);

        averageElement.textContent =
            "No ratings yet";

        countElement.textContent =
            "Customer reviews";
    }
}

loadHomeReviewSummary();