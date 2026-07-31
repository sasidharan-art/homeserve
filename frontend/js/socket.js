const socket = io(window.location.origin);

socket.on("connect", () => {
    console.log("✅ Connected to Socket.IO Server");
});

// New booking created
socket.on("new-booking", () => {

    console.log("📌 New Booking");

    if (typeof loadBookings === "function") {
        loadBookings();
    }

});

// Booking status updated
socket.on("booking-status-updated", () => {

    console.log("🔄 Booking Updated");

    if (typeof loadBookings === "function") {
        loadBookings();
    }

});

// Booking cancelled
socket.on("booking-cancelled", () => {

    console.log("❌ Booking Cancelled");

    if (typeof loadBookings === "function") {
        loadBookings();
    }

});

// Provider availability changed
socket.on("provider-availability", (data) => {

    console.log("🟢 Provider Availability:", data);

});