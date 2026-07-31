const API = `${window.location.origin}/api/services`;

// Load Services
async function loadServices() {

    try {

        const response = await fetch(API);

        const services = await response.json();

        const container = document.getElementById("services");

        container.innerHTML = "";

        services.forEach(service => {

            container.innerHTML += `

                <div class="card">

                    <h3>${service.name}</h3>

                    <p>${service.description}</p>

                    <p><strong>Category:</strong> ${service.category}</p>

                    <h4>₹${service.price}</h4>

                    <button class="service-btn"
                        onclick="bookService('${service._id}')">

                        Book Now

                    </button>

                </div>

            `;

        });

    }

    catch (err) {

        console.error(err);

        document.getElementById("services").innerHTML =

            "<h3>Unable to load services.</h3>";

    }

}

// Book Service
function bookService(serviceId) {

    const token = localStorage.getItem("token");

    if (!token) {

        notify("Please login first.", "warning");

        window.location.href = "login.html";

        return;

    }

    localStorage.setItem("serviceId", serviceId);

    window.location.href = "booking.html";

}

// Start
loadServices();