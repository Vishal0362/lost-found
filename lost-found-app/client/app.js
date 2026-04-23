const API = `${window.location.origin}/api/items`;
const bookmarksKey = "tracebox-bookmarks";

const state = {
  items: [],
  summary: null,
  bookmarks: new Set(JSON.parse(localStorage.getItem(bookmarksKey) || "[]")),
  viewerLocation: null,
  formLocation: null,
};

const els = {
  activeCount: document.getElementById("activeCount"),
  lostCount: document.getElementById("lostCount"),
  foundCount: document.getElementById("foundCount"),
  uploadForm: document.getElementById("uploadForm"),
  items: document.getElementById("items"),
  matches: document.getElementById("matches"),
  matchCount: document.getElementById("matchCount"),
  bookmarkItems: document.getElementById("bookmarkItems"),
  bookmarkCount: document.getElementById("bookmarkCount"),
  locationStatus: document.getElementById("locationStatus"),
  formLocationStatus: document.getElementById("formLocationStatus"),
  formBadge: document.getElementById("formBadge"),
  resultMeta: document.getElementById("resultMeta"),
  submitBtn: document.getElementById("submitBtn"),
  shareLocationBtn: document.getElementById("shareLocationBtn"),
  detectFormLocationBtn: document.getElementById("detectFormLocationBtn"),
  type: document.getElementById("type"),
  category: document.getElementById("category"),
  title: document.getElementById("title"),
  description: document.getElementById("description"),
  reward: document.getElementById("reward"),
  dateOfIncident: document.getElementById("dateOfIncident"),
  locationLabel: document.getElementById("locationLabel"),
  contactName: document.getElementById("contactName"),
  contactInfo: document.getElementById("contactInfo"),
  image: document.getElementById("image"),
  searchInput: document.getElementById("searchInput"),
  filterType: document.getElementById("filterType"),
  filterCategory: document.getElementById("filterCategory"),
  sortSelect: document.getElementById("sortSelect"),
  statusFilter: document.getElementById("statusFilter"),
  maxDistance: document.getElementById("maxDistance"),
  resetFiltersBtn: document.getElementById("resetFiltersBtn"),
  itemTemplate: document.getElementById("itemTemplate"),
};

const formatDistance = (distanceKm) => {
  if (typeof distanceKm !== "number" || Number.isNaN(distanceKm)) {
    return "Distance unavailable";
  }

  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m away`;
  }

  return `${distanceKm.toFixed(1)} km away`;
};

const formatDate = (value) => {
  if (!value) {
    return "Date not shared";
  }

  return new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const saveBookmarks = () => {
  localStorage.setItem(bookmarksKey, JSON.stringify([...state.bookmarks]));
};

const setBanner = (message, tone = "ready") => {
  els.formBadge.textContent = message;
  els.formBadge.className =
    tone === "success"
      ? "rounded-full bg-pine/10 px-4 py-2 text-sm font-semibold text-pine"
      : tone === "error"
        ? "rounded-full bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
        : "rounded-full bg-coral/10 px-4 py-2 text-sm font-semibold text-coral";
};

const updateLocationText = () => {
  if (!state.viewerLocation) {
    els.locationStatus.textContent = "Location not connected yet.";
    return;
  }

  const { lat, lng } = state.viewerLocation;
  els.locationStatus.textContent = `Connected at ${lat.toFixed(4)}, ${lng.toFixed(4)}. Nearby reports are now distance-sorted.`;
};

const updateFormLocationText = () => {
  if (!state.formLocation) {
    els.formLocationStatus.textContent = "No coordinates selected yet. Use your current location before posting.";
    return;
  }

  const { lat, lng } = state.formLocation;
  els.formLocationStatus.textContent = `Pinned at ${lat.toFixed(4)}, ${lng.toFixed(4)}. This will be attached to the report.`;
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000,
    });
  });

const hydrateLocation = async (target = "viewer") => {
  try {
    const position = await getCurrentPosition();
    const coords = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
    };

    if (target === "viewer") {
      state.viewerLocation = coords;
      updateLocationText();
      await loadItems();
    } else {
      state.formLocation = coords;
      updateFormLocationText();
    }
  } catch (error) {
    if (target === "viewer") {
      els.locationStatus.textContent = "Location permission denied. Results stay available without distance sorting.";
    } else {
      els.formLocationStatus.textContent = "Could not detect your location. You can still submit after allowing location access.";
    }
  }
};

const buildQuery = () => {
  const params = new URLSearchParams();
  const search = els.searchInput.value.trim();
  const type = els.filterType.value;
  const category = els.filterCategory.value;
  const sort = els.sortSelect.value;
  const status = els.statusFilter.value;
  const maxDistance = els.maxDistance.value.trim();

  if (search) params.set("search", search);
  if (type) params.set("type", type);
  if (category) params.set("category", category);
  if (sort) params.set("sort", sort);
  if (status) params.set("status", status);
  if (maxDistance) params.set("maxDistance", maxDistance);

  if (state.viewerLocation) {
    params.set("lat", state.viewerLocation.lat);
    params.set("lng", state.viewerLocation.lng);
  }

  return params.toString();
};

const renderSummary = () => {
  const summary = state.summary || { active: 0, lost: 0, found: 0 };
  els.activeCount.textContent = summary.active ?? 0;
  els.lostCount.textContent = summary.lost ?? 0;
  els.foundCount.textContent = summary.found ?? 0;
};

const renderBookmarks = () => {
  const bookmarkedItems = state.items.filter((item) => state.bookmarks.has(item._id)).slice(0, 6);
  els.bookmarkCount.textContent = `${state.bookmarks.size} saved`;

  if (!bookmarkedItems.length) {
    els.bookmarkItems.innerHTML = '<p class="text-sm text-slate-500">No saved posts yet.</p>';
    return;
  }

  els.bookmarkItems.innerHTML = bookmarkedItems
    .map(
      (item) => `
        <button data-id="${item._id}" class="bookmark-chip rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
          ${item.title}
        </button>
      `
    )
    .join("");
};

const buildMatchSuggestions = () => {
  const lostItems = state.items.filter((item) => item.type === "lost" && item.status === "active");
  const foundItems = state.items.filter((item) => item.type === "found" && item.status === "active");
  const suggestions = [];

  for (const lost of lostItems) {
    for (const found of foundItems) {
      const sameCategory = lost.category === found.category;
      const nearEnough =
        typeof lost.distanceKm === "number" && typeof found.distanceKm === "number"
          ? Math.abs(lost.distanceKm - found.distanceKm) <= 5
          : true;
      const titleOverlap = lost.title.toLowerCase().split(" ").some((word) => word.length > 3 && found.title.toLowerCase().includes(word));

      if ((sameCategory && nearEnough) || (sameCategory && titleOverlap)) {
        suggestions.push({ lost, found });
      }
    }
  }

  return suggestions.slice(0, 4);
};

const renderMatches = () => {
  const matches = buildMatchSuggestions();
  els.matchCount.textContent = `${matches.length} hints`;

  if (!matches.length) {
    els.matches.innerHTML = `
      <div class="rounded-3xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">
        No obvious matches yet. As more reports are posted, likely pairs will appear here automatically.
      </div>
    `;
    return;
  }

  els.matches.innerHTML = matches
    .map(
      ({ lost, found }) => `
        <div class="slide-up rounded-3xl bg-slate-50 p-5">
          <p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Potential match</p>
          <p class="mt-3 text-sm text-slate-700"><span class="font-semibold text-ink">${lost.title}</span> may relate to <span class="font-semibold text-ink">${found.title}</span>.</p>
          <p class="mt-2 text-sm text-slate-500">Shared category: ${lost.category}. Lost near ${lost.location.label || "shared area"} and found near ${found.location.label || "shared area"}.</p>
        </div>
      `
    )
    .join("");
};

const renderItems = () => {
  els.resultMeta.textContent = `${state.items.length} report${state.items.length === 1 ? "" : "s"} loaded`;

  if (!state.items.length) {
    els.items.innerHTML = `
      <div class="rounded-3xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500 xl:col-span-2">
        No reports match the current filters. Try widening the distance or switching category/type filters.
      </div>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  state.items.forEach((item, index) => {
    const node = els.itemTemplate.content.cloneNode(true);
    const card = node.querySelector(".card-shell");
    const image = node.querySelector(".item-image");
    const imageFallback = node.querySelector(".image-fallback");
    const typeBadge = node.querySelector(".type-badge");
    const statusBadge = node.querySelector(".status-badge");
    const categoryBadge = node.querySelector(".category-badge");
    const title = node.querySelector(".item-title");
    const description = node.querySelector(".item-description");
    const location = node.querySelector(".item-location");
    const coordinates = node.querySelector(".item-coordinates");
    const contact = node.querySelector(".item-contact");
    const incident = node.querySelector(".item-incident");
    const distancePill = node.querySelector(".distance-pill");
    const rewardPill = node.querySelector(".reward-pill");
    const mapsLink = node.querySelector(".maps-link");
    const statusBtn = node.querySelector(".status-btn");
    const bookmarkBtn = node.querySelector(".bookmark-btn");

    card.style.animationDelay = `${index * 70}ms`;
    card.classList.add("slide-up");

    if (item.image) {
      image.src = `${window.location.origin}/uploads/${item.image}`;
      image.alt = item.title;
    } else {
      image.classList.add("hidden");
      imageFallback.classList.remove("hidden");
      imageFallback.classList.add("flex");
    }

    typeBadge.textContent = item.type;
    typeBadge.className =
      item.type === "lost"
        ? "type-badge rounded-full bg-coral/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-coral"
        : "type-badge rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-sky-700";

    statusBadge.textContent = item.status;
    statusBadge.className =
      item.status === "resolved"
        ? "status-badge rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
        : "status-badge rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800";

    categoryBadge.textContent = item.category;
    title.textContent = item.title;
    description.textContent = item.description || "No extra description shared.";
    location.textContent = item.location.label || "Pinned community location";
    coordinates.textContent = `${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}`;
    contact.textContent = [item.contactName, item.contactInfo].filter(Boolean).join(" • ") || "Contact details not shared";
    incident.textContent = `Reported for ${formatDate(item.dateOfIncident)} • Posted ${formatDate(item.createdAt)}`;
    distancePill.textContent = formatDistance(item.distanceKm);
    rewardPill.textContent = item.reward > 0 ? `Reward: ${item.reward}` : "No reward listed";
    mapsLink.href = `https://www.google.com/maps?q=${item.location.lat},${item.location.lng}`;
    statusBtn.textContent = item.status === "resolved" ? "Reopen" : "Mark resolved";
    statusBtn.dataset.id = item._id;
    statusBtn.dataset.status = item.status === "resolved" ? "active" : "resolved";
    bookmarkBtn.dataset.id = item._id;
    bookmarkBtn.textContent = state.bookmarks.has(item._id) ? "Saved" : "Save";

    fragment.appendChild(node);
  });

  els.items.innerHTML = "";
  els.items.appendChild(fragment);
};

const loadSummary = async () => {
  const response = await fetch(`${API}/summary`);
  if (!response.ok) {
    throw new Error("Failed to load summary");
  }

  state.summary = await response.json();
  renderSummary();
};

const loadItems = async () => {
  const response = await fetch(`${API}?${buildQuery()}`);
  if (!response.ok) {
    throw new Error("Failed to load items");
  }

  state.items = await response.json();
  renderItems();
  renderBookmarks();
  renderMatches();
};

const refreshAll = async () => {
  try {
    await Promise.all([loadSummary(), loadItems()]);
  } catch (error) {
    els.resultMeta.textContent = "Could not load data. Check whether the server is running and MongoDB is connected.";
  }
};

const resetFilters = () => {
  els.searchInput.value = "";
  els.filterType.value = "all";
  els.filterCategory.value = "all";
  els.sortSelect.value = "latest";
  els.statusFilter.value = "active";
  els.maxDistance.value = "";
  loadItems();
};

const submitForm = async (event) => {
  event.preventDefault();

  if (!state.formLocation) {
    setBanner("Location required", "error");
    els.formLocationStatus.textContent = "Attach a location before posting so the distance feature works.";
    return;
  }

  const formData = new FormData();
  formData.append("title", els.title.value.trim());
  formData.append("description", els.description.value.trim());
  formData.append("type", els.type.value);
  formData.append("category", els.category.value);
  formData.append("reward", els.reward.value.trim());
  formData.append("contactName", els.contactName.value.trim());
  formData.append("contactInfo", els.contactInfo.value.trim());
  formData.append("dateOfIncident", els.dateOfIncident.value || new Date().toISOString());
  formData.append("locationLabel", els.locationLabel.value.trim());
  formData.append("lat", state.formLocation.lat);
  formData.append("lng", state.formLocation.lng);

  if (els.image.files[0]) {
    formData.append("image", els.image.files[0]);
  }

  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Publishing...";
  setBanner("Uploading...", "ready");

  try {
    const response = await fetch(`${API}/upload`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || "Upload failed");
    }

    els.uploadForm.reset();
    state.formLocation = null;
    updateFormLocationText();
    setBanner("Report live", "success");
    await refreshAll();
  } catch (error) {
    setBanner("Upload failed", "error");
  } finally {
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Publish report";
  }
};

const updateStatus = async (id, status) => {
  const response = await fetch(`${API}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    throw new Error("Status update failed");
  }

  await refreshAll();
};

els.shareLocationBtn.addEventListener("click", () => hydrateLocation("viewer"));
els.detectFormLocationBtn.addEventListener("click", () => hydrateLocation("form"));
els.uploadForm.addEventListener("submit", submitForm);

[els.searchInput, els.filterType, els.filterCategory, els.sortSelect, els.statusFilter, els.maxDistance].forEach((element) => {
  const eventName = element.tagName === "INPUT" ? "input" : "change";
  element.addEventListener(eventName, () => loadItems());
});

els.resetFiltersBtn.addEventListener("click", resetFilters);

els.items.addEventListener("click", async (event) => {
  const statusBtn = event.target.closest(".status-btn");
  const bookmarkBtn = event.target.closest(".bookmark-btn");

  if (bookmarkBtn) {
    const { id } = bookmarkBtn.dataset;
    if (state.bookmarks.has(id)) {
      state.bookmarks.delete(id);
    } else {
      state.bookmarks.add(id);
    }
    saveBookmarks();
    renderItems();
    renderBookmarks();
    return;
  }

  if (!statusBtn) {
    return;
  }

  try {
    await updateStatus(statusBtn.dataset.id, statusBtn.dataset.status);
  } catch (error) {
    els.resultMeta.textContent = "Could not update status.";
  }
});

els.bookmarkItems.addEventListener("click", (event) => {
  const chip = event.target.closest(".bookmark-chip");
  if (!chip) {
    return;
  }

  const card = document.querySelector(`[data-id="${chip.dataset.id}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
  }
});

els.dateOfIncident.value = new Date().toISOString().split("T")[0];
updateLocationText();
updateFormLocationText();
refreshAll();
