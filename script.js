
const API = "/api/events";
const $ = id => document.getElementById(id);

let events = [];
let editingId = null;

const pages = {
    home: $("homePage"),
    events: $("eventsPage"),
    create: $("createPage")
};

const fallbackImages = {
    Cultural: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=700&q=80",
    Technical: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=700&q=80",
    Workshop: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=700&q=80",
    Seminar: "https://images.unsplash.com/photo-1475721027785-f74eccf877e2?auto=format&fit=crop&w=700&q=80",
    Sports: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=700&q=80",
    Academic: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=700&q=80",
    Other: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=700&q=80"
};

function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;",
        '"': "&quot;", "'": "&#39;"
    })[c]);
}

function imageUrl(event) {
    if (event.image) return "/uploads/" + encodeURIComponent(event.image);
    return fallbackImages[event.event_type] || fallbackImages.Other;
}

function formatDate(value) {
    if (!value) return "—";
    const datePart = String(value).slice(0, 10);
    const parts = datePart.split("-");
    if (parts.length !== 3) return datePart;
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
        .toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });
}

function notice(message, error = false) {
    const box = $("notice");
    box.textContent = message;
    box.hidden = false;
    box.classList.toggle("error", error);
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => box.hidden = true, 4000);
}

function showPage(name) {
    Object.entries(pages).forEach(([key, section]) => {
        section.hidden = key !== name;
    });

    document.querySelectorAll(".nav-btn").forEach(button => {
        button.classList.toggle("active", button.dataset.page === name);
    });
}

function renderStats() {
    $("totalEvents").textContent = events.length;
    $("totalTypes").textContent = new Set(events.map(e => e.event_type)).size;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    $("upcomingEvents").textContent = events.filter(e => {
        const date = new Date(String(e.event_date).slice(0, 10) + "T00:00:00");
        return !Number.isNaN(date.getTime()) && date >= today;
    }).length;
}

function renderCards() {
    const featured = [...events]
        .sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))
        .slice(0, 6);

    $("eventCards").innerHTML = featured.length
        ? featured.map(e => `
            <article class="event-card">
                <img src="${esc(imageUrl(e))}" alt="${esc(e.event_name)}"
                     onerror="this.onerror=null;this.src='${fallbackImages.Other}'">
                <div class="event-card-body">
                    <span class="pill">${esc(e.event_type)}</span>
                    <h3>${esc(e.event_name)}</h3>
                    <div class="event-meta">
                        <div>📅 ${esc(formatDate(e.event_date))}</div>
                        <div>📍 ${esc(e.venue)}</div>
                    </div>
                    <p>${esc(e.description)}</p>
                    <div class="action-buttons">
                        <button class="action-btn view-btn" data-action="view" data-id="${e.id}">View</button>
                        <button class="action-btn edit-btn" data-action="edit" data-id="${e.id}">Update</button>
                        <button class="action-btn delete-btn" data-action="delete" data-id="${e.id}">Delete</button>
                    </div>
                </div>
            </article>
        `).join("")
        : `<div class="empty-state"><h3>Welcome to Likki's Events!</h3><p>Create your first college event to see it featured here.</p><button class="btn primary" data-page="create">＋ Create Event</button></div>`;
}

function renderTable() {
    const search = $("searchInput").value.trim().toLowerCase();
    const type = $("typeFilter").value;

    const filtered = events.filter(e => {
        const text = [
            e.event_name, e.event_type, e.venue, e.description, e.event_date
        ].some(value => String(value ?? "").toLowerCase().includes(search));

        return text && (!type || e.event_type === type);
    });

    $("eventsTable").innerHTML = filtered.map(e => `
        <tr>
            <td>
                <div class="event-cell">
                    <img class="event-thumb" src="${esc(imageUrl(e))}" alt=""
                         onerror="this.onerror=null;this.src='${fallbackImages.Other}'">
                    <div><strong>${esc(e.event_name)}</strong><small>ID: ${e.id}</small></div>
                </div>
            </td>
            <td><span class="pill">${esc(e.event_type)}</span></td>
            <td>${esc(formatDate(e.event_date))}</td>
            <td>${esc(e.venue)}</td>
            <td><div class="description-cell">${esc(e.description)}</div></td>
            <td><div class="action-buttons">
                <button class="action-btn view-btn" data-action="view" data-id="${e.id}">View</button>
                <button class="action-btn edit-btn" data-action="edit" data-id="${e.id}">Update</button>
                <button class="action-btn delete-btn" data-action="delete" data-id="${e.id}">Delete</button>
            </div></td>
        </tr>
    `).join("");

    $("emptyState").hidden = filtered.length > 0;
    $("recordCount").textContent = `Showing ${filtered.length} of ${events.length} events`;
}

function render() {
    renderStats();
    renderCards();
    renderTable();
}

async function loadEvents() {
    try {
        const response = await fetch(API);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load events");
        events = data;
        render();
    } catch (error) {
        notice(error.message, true);
    }
}

function resetForm() {
    editingId = null;
    $("eventForm").reset();
    $("eventId").value = "";
    $("imagePreview").src = fallbackImages.Cultural;
    $("formTitle").textContent = "Create New Event";
    $("saveBtn").textContent = "Create Event";
}

function createEvent() {
    resetForm();
    showPage("create");
}

function editEvent(id) {
    const e = events.find(item => String(item.id) === String(id));
    if (!e) return notice("Event not found.", true);

    editingId = e.id;
    $("eventId").value = e.id;
    $("event_name").value = e.event_name || "";
    $("event_type").value = e.event_type || "";
    $("event_date").value = String(e.event_date).slice(0, 10);
    $("venue").value = e.venue || "";
    $("description").value = e.description || "";
    $("image").value = "";
    $("imagePreview").src = imageUrl(e);
    $("formTitle").textContent = "Update Event";
    $("saveBtn").textContent = "Save Changes";
    showPage("create");
}

async function viewEvent(id) {
    try {
        const response = await fetch(`${API}/${id}`);
        const e = await response.json();
        if (!response.ok) throw new Error(e.error || "Event not found");

        $("eventDetails").innerHTML = `
            <div class="detail-content">
                <img class="detail-image" src="${esc(imageUrl(e))}" alt="${esc(e.event_name)}">
                <span class="pill">${esc(e.event_type)}</span>
                <h2>${esc(e.event_name)}</h2>
                <p><strong>Date:</strong> ${esc(formatDate(e.event_date))}</p>
                <p><strong>Venue:</strong> ${esc(e.venue)}</p>
                <p><strong>Description:</strong><br>${esc(e.description)}</p>
                <button class="btn primary" data-action="edit" data-id="${e.id}">Update Event</button>
            </div>`;
        $("detailsDialog").showModal();
    } catch (error) {
        notice(error.message, true);
    }
}

async function deleteEvent(id) {
    const e = events.find(item => String(item.id) === String(id));
    if (!e) return notice("Event not found.", true);

    if (!confirm(`Delete "${e.event_name}"? This cannot be undone.`)) return;

    try {
        const response = await fetch(`${API}/${id}`, { method: "DELETE" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Delete failed");

        notice("Event deleted successfully!");
        await loadEvents();
    } catch (error) {
        notice(error.message, true);
    }
}

$("eventForm").addEventListener("submit", async event => {
    event.preventDefault();

    const formData = new FormData($("eventForm"));
    const url = editingId ? `${API}/${editingId}` : API;
    const method = editingId ? "PUT" : "POST";

    $("saveBtn").disabled = true;

    try {
        const response = await fetch(url, { method, body: formData });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save event");

        notice(data.message || "Event saved successfully!");
        resetForm();
        await loadEvents();
        showPage("events");
    } catch (error) {
        notice(error.message, true);
    } finally {
        $("saveBtn").disabled = false;
        $("saveBtn").textContent = editingId ? "Save Changes" : "Create Event";
    }
});

document.addEventListener("click", event => {
    const pageButton = event.target.closest("[data-page]");
    if (pageButton) {
        if (pageButton.dataset.page === "create") createEvent();
        else showPage(pageButton.dataset.page);
        return;
    }

    const action = event.target.closest("[data-action]");
    if (!action) return;

    const id = action.dataset.id;
    if (action.dataset.action === "view") viewEvent(id);
    if (action.dataset.action === "edit") {
        $("detailsDialog").close();
        editEvent(id);
    }
    if (action.dataset.action === "delete") deleteEvent(id);
});

$("searchInput").addEventListener("input", renderTable);
$("typeFilter").addEventListener("change", renderTable);

$("image").addEventListener("change", () => {
    const file = $("image").files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        notice("Image must be 5 MB or smaller.", true);
        $("image").value = "";
        return;
    }

    if (!file.type.startsWith("image/")) {
        notice("Please select an image file.", true);
        $("image").value = "";
        return;
    }

    $("imagePreview").src = URL.createObjectURL(file);
});

$("eventForm").addEventListener("reset", () => {
    setTimeout(() => {
        if (!editingId) $("imagePreview").src = fallbackImages.Cultural;
    }, 0);
});

$("cancelBtn").addEventListener("click", () => {
    resetForm();
    showPage("events");
});
$("cancelFormBtn").addEventListener("click", () => {
    resetForm();
    showPage("events");
});
$("closeDetails").addEventListener("click", () => $("detailsDialog").close());
$("detailsDialog").addEventListener("click", event => {
    if (event.target === $("detailsDialog")) $("detailsDialog").close();
});

loadEvents();
showPage("home");
