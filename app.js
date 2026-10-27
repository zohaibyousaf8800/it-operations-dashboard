/**
 * IT Operations Dashboard — app.js
 * Dependency-free ticket & asset management.
 *
 * Architecture:
 *  - A tiny store layer persists state to localStorage (with seed data on first run).
 *  - Render functions are pure-ish: they read state + current filters and rebuild the DOM.
 *  - Charts are hand-rolled on <canvas> — no CDN, no chart library.
 *  - All user text is inserted via textContent / escaped HTML helpers to avoid HTML injection.
 */
"use strict";

/* ------------------------------------------------------------------ */
/* Constants & seed data                                               */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "it-ops-dashboard:v1";

const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"];
const TICKET_PRIORITIES = ["Critical", "High", "Medium", "Low"];
const STATUS_COLORS = { Open: "#2563eb", "In Progress": "#d97706", Resolved: "#16a34a", Closed: "#64748b" };
const PRIORITY_COLORS = { Critical: "#dc2626", High: "#ea580c", Medium: "#ca8a04", Low: "#65a30d" };

/** Realistic operations seed data — first-run only, fully editable/deletable in the UI. */
function seedState() {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const tickets = [
    { id: "TCK-1001", title: "Outlook not syncing after mailbox migration", description: "User cannot receive new mail after the Microsoft 365 mailbox move.", requester: "Finance Team", assignee: "Zohaib Yousaf", status: "In Progress", priority: "High", createdAt: now - 2 * day, resolutionHours: null },
    { id: "TCK-1002", title: "New starter laptop provisioning — Intune enrolment", description: "Prepare, enrol and hand over a laptop for a new starter, with standard apps and policies.", requester: "HR Department", assignee: "Zohaib Yousaf", status: "Open", priority: "Medium", createdAt: now - 1 * day, resolutionHours: null },
    { id: "TCK-1003", title: "VPN drops on home Wi-Fi", description: "Remote user reports VPN disconnecting every few minutes.", requester: "Sales Team", assignee: "IT Support", status: "Open", priority: "Medium", createdAt: now - 5 * 60 * 60 * 1000, resolutionHours: null },
    { id: "TCK-1004", title: "Printer on 2nd floor not responding", description: "Network printer offline; checked share and spooler, needs on-site check.", requester: "Operations", assignee: "IT Support", status: "In Progress", priority: "Low", createdAt: now - 3 * day, resolutionHours: null },
    { id: "TCK-1005", title: "MFA reset and Conditional Access check", description: "User changed phone; reset MFA and verified Conditional Access sign-in.", requester: "Procurement", assignee: "Zohaib Yousaf", status: "Resolved", priority: "High", createdAt: now - 4 * day, resolutionHours: 3.5 },
    { id: "TCK-1006", title: "Shared drive permissions for project folder", description: "Grant read/write access to the project shared folder for two team members.", requester: "Projects Team", assignee: "IT Support", status: "Resolved", priority: "Low", createdAt: now - 6 * day, resolutionHours: 1 },
    { id: "TCK-1007", title: "Laptop battery swollen — replacement required", description: "Device quarantined for safety; replacement issued from stock.", requester: "Support Desk User", assignee: "Zohaib Yousaf", status: "Closed", priority: "Critical", createdAt: now - 9 * day, resolutionHours: 26 },
    { id: "TCK-1008", title: "Windows update compliance below target", description: "Several endpoints missing the latest cumulative update; remediation via Intune ring.", requester: "IT Manager Review", assignee: "Zohaib Yousaf", status: "Open", priority: "High", createdAt: now - 7 * 60 * 60 * 1000, resolutionHours: null }
  ];
  const assets = [
    { id: "AST-01", tag: "LT-1042", device: "Dell Latitude 5440", type: "Laptop", assignedTo: "Finance Team", status: "In Use", compliance: "Compliant" },
    { id: "AST-02", tag: "LT-1043", device: "HP EliteBook 840 G9", type: "Laptop", assignedTo: "HR Department", status: "In Use", compliance: "Compliant" },
    { id: "AST-03", tag: "LT-1051", device: "Lenovo ThinkPad T14", type: "Laptop", assignedTo: "", status: "In Stock", compliance: "Compliant" },
    { id: "AST-04", tag: "DT-0210", device: "Dell OptiPlex 7010", type: "Desktop", assignedTo: "Operations", status: "In Use", compliance: "Non-compliant" },
    { id: "AST-05", tag: "MN-0331", device: "Dell P2422H 24-inch Monitor", type: "Monitor", assignedTo: "Finance Team", status: "In Use", compliance: "Compliant" },
    { id: "AST-06", tag: "PH-0118", device: "Samsung Galaxy A54", type: "Phone", assignedTo: "Sales Team", status: "In Use", compliance: "Compliant" },
    { id: "AST-07", tag: "LT-1036", device: "HP ProBook 450 G8", type: "Laptop", assignedTo: "Support Desk User", status: "In Repair", compliance: "Non-compliant" },
    { id: "AST-08", tag: "PR-0042", device: "HP LaserJet Pro M404dn", type: "Printer", assignedTo: "Office — 2nd Floor", status: "In Use", compliance: "Compliant" },
    { id: "AST-09", tag: "NW-0017", device: "TP-Link Archer AX Router", type: "Network", assignedTo: "Office Network", status: "In Use", compliance: "Compliant" },
    { id: "AST-10", tag: "LT-1019", device: "Acer TravelMate P2", type: "Laptop", assignedTo: "", status: "Retired", compliance: "Non-compliant" }
  ];
  return { tickets, assets, ticketSeq: 1009, assetSeq: 11 };
}

/* ------------------------------------------------------------------ */
/* Store                                                               */
/* ------------------------------------------------------------------ */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = seedState();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
      return seeded;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.tickets) || !Array.isArray(parsed.assets)) throw new Error("Bad state");
    return parsed;
  } catch (err) {
    // Corrupt storage should never brick the app — fall back to seed data.
    const seeded = seedState();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded)); } catch (_) { /* storage unavailable */ }
    return seeded;
  }
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { /* storage unavailable */ }
}

let state = loadState();

/* ------------------------------------------------------------------ */
/* DOM helpers                                                         */
/* ------------------------------------------------------------------ */

const $ = (id) => document.getElementById(id);

/** Escape user-provided text before it is used inside an HTML string. */
function esc(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function pillClass(value) {
  const map = {
    Open: "pill-open", "In Progress": "pill-progress", Resolved: "pill-resolved", Closed: "pill-closed",
    Critical: "pill-critical", High: "pill-high", Medium: "pill-medium", Low: "pill-low",
    Compliant: "pill-ok", "Non-compliant": "pill-bad",
    "In Use": "pill-open", "In Stock": "pill-resolved", "In Repair": "pill-progress", Retired: "pill-closed"
  };
  return map[value] || "pill-neutral";
}

function pill(value) {
  return `<span class="pill ${pillClass(value)}">${esc(value)}</span>`;
}

let toastTimer = null;
function showToast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ------------------------------------------------------------------ */
/* Derived metrics (KPIs)                                              */
/* ------------------------------------------------------------------ */

function computeKpis() {
  const openTickets = state.tickets.filter((t) => t.status === "Open" || t.status === "In Progress").length;
  const criticalOpen = state.tickets.filter((t) => (t.status === "Open" || t.status === "In Progress") && t.priority === "Critical").length;
  const compliant = state.assets.filter((a) => a.compliance === "Compliant").length;
  const compliancePct = state.assets.length ? Math.round((compliant / state.assets.length) * 100) : 0;
  const resolved = state.tickets.filter((t) => typeof t.resolutionHours === "number");
  const avgResolution = resolved.length
    ? (resolved.reduce((sum, t) => sum + t.resolutionHours, 0) / resolved.length)
    : null;
  return { openTickets, criticalOpen, compliancePct, avgResolution, totalAssets: state.assets.length, compliant };
}

function countBy(items, key, order) {
  return order.map((label) => ({ label, count: items.filter((i) => i[key] === label).length }));
}

/* ------------------------------------------------------------------ */
/* Hand-rolled canvas bar chart (no libraries)                         */
/* ------------------------------------------------------------------ */

/**
 * Draw a simple, crisp bar chart on a canvas.
 * Handles devicePixelRatio so bars stay sharp on retina displays.
 */
function drawBarChart(canvas, data, colors) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.width;
  const cssHeight = 280;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + "px";

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const padding = { top: 28, right: 12, bottom: 34, left: 34 };
  const chartW = cssWidth - padding.left - padding.right;
  const chartH = cssHeight - padding.top - padding.bottom;
  const max = Math.max(1, ...data.map((d) => d.count));

  // Gridlines + y labels
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillStyle = "#64748b";
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  const steps = Math.min(max, 5);
  for (let i = 0; i <= steps; i++) {
    const value = Math.round((max / steps) * i);
    const y = padding.top + chartH - (chartH * i) / steps;
    ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(padding.left + chartW, y); ctx.stroke();
    ctx.fillText(String(value), 8, y + 4);
  }

  if (!data.length) return;
  const slot = chartW / data.length;
  const barW = Math.min(64, slot * 0.55);

  data.forEach((d, i) => {
    const x = padding.left + slot * i + (slot - barW) / 2;
    const h = (d.count / max) * chartH;
    const y = padding.top + chartH - h;
    ctx.fillStyle = colors[d.label] || "#2563eb";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, barW, h, [6, 6, 0, 0]);
    else ctx.rect(x, y, barW, h);
    ctx.fill();
    // Value on top of the bar
    ctx.fillStyle = "#17202b";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(d.count), x + barW / 2, Math.max(14, y - 8));
    // Category label under the bar
    ctx.fillStyle = "#64748b";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(d.label, x + barW / 2, padding.top + chartH + 22);
    ctx.textAlign = "left";
  });
}

function renderLegend(el, data, colors) {
  el.innerHTML = data.map((d) =>
    `<li><span class="swatch" style="background:${esc(colors[d.label] || "#2563eb")}"></span>${esc(d.label)}: <strong>${d.count}</strong></li>`
  ).join("");
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */

function renderDashboard() {
  const k = computeKpis();
  $("kpiOpenTickets").textContent = String(k.openTickets);
  $("kpiOpenNote").textContent = k.criticalOpen ? `${k.criticalOpen} critical ticket(s) need attention` : "No critical tickets open";
  $("kpiAssets").textContent = String(k.totalAssets);
  $("kpiAssetsNote").textContent = `${k.compliant} compliant of ${k.totalAssets} tracked assets`;
  $("kpiCompliance").textContent = k.totalAssets ? `${k.compliancePct}%` : "—";
  $("kpiResolution").textContent = k.avgResolution === null ? "—" : `${k.avgResolution.toFixed(1)} h`;

  $("navTicketCount").textContent = String(state.tickets.length);
  $("navAssetCount").textContent = String(state.assets.length);

  const byStatus = countBy(state.tickets, "status", TICKET_STATUSES);
  const byPriority = countBy(state.tickets, "priority", TICKET_PRIORITIES);
  drawBarChart($("statusChart"), byStatus, STATUS_COLORS);
  drawBarChart($("priorityChart"), byPriority, PRIORITY_COLORS);
  renderLegend($("statusLegend"), byStatus, STATUS_COLORS);
  renderLegend($("priorityLegend"), byPriority, PRIORITY_COLORS);

  const recent = [...state.tickets].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  $("recentTicketsBody").innerHTML = recent.map((t) => `
    <tr><td>${esc(t.id)}</td><td>${esc(t.title)}</td><td>${pill(t.status)}</td><td>${pill(t.priority)}</td><td>${esc(t.assignee)}</td></tr>
  `).join("");
  $("recentEmpty").hidden = recent.length > 0;
}

function getFilteredTickets() {
  const q = $("ticketSearch").value.trim().toLowerCase();
  const status = $("ticketStatusFilter").value;
  const priority = $("ticketPriorityFilter").value;
  return state.tickets.filter((t) => {
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (q && ![t.title, t.requester, t.assignee, t.id].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderTickets() {
  const rows = getFilteredTickets().sort((a, b) => b.createdAt - a.createdAt);
  $("ticketsBody").innerHTML = rows.map((t) => `
    <tr>
      <td>${esc(t.id)}</td><td><strong>${esc(t.title)}</strong></td>
      <td>${esc(t.requester)}</td><td>${esc(t.assignee)}</td>
      <td>${pill(t.status)}</td><td>${pill(t.priority)}</td>
      <td>${formatDate(t.createdAt)}</td>
      <td>${typeof t.resolutionHours === "number" ? esc(t.resolutionHours) + " h" : "—"}</td>
      <td><div class="row-actions">
        <button class="btn btn-secondary btn-small" type="button" data-edit-ticket="${esc(t.id)}" aria-label="Edit ticket ${esc(t.id)}">Edit</button>
        <button class="btn btn-danger btn-small" type="button" data-delete-ticket="${esc(t.id)}" aria-label="Delete ticket ${esc(t.id)}">Delete</button>
      </div></td>
    </tr>`).join("");
  $("ticketsEmpty").hidden = rows.length > 0;
}

function getFilteredAssets() {
  const q = $("assetSearch").value.trim().toLowerCase();
  const status = $("assetStatusFilter").value;
  const compliance = $("assetComplianceFilter").value;
  return state.assets.filter((a) => {
    if (status && a.status !== status) return false;
    if (compliance && a.compliance !== compliance) return false;
    if (q && ![a.tag, a.device, a.type, a.assignedTo].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderAssets() {
  const rows = getFilteredAssets();
  $("assetsBody").innerHTML = rows.map((a) => `
    <tr>
      <td>${esc(a.tag)}</td><td><strong>${esc(a.device)}</strong></td><td>${esc(a.type)}</td>
      <td>${esc(a.assignedTo || "Unassigned")}</td><td>${pill(a.status)}</td><td>${pill(a.compliance)}</td>
      <td><div class="row-actions">
        <button class="btn btn-secondary btn-small" type="button" data-edit-asset="${esc(a.id)}" aria-label="Edit asset ${esc(a.tag)}">Edit</button>
        <button class="btn btn-danger btn-small" type="button" data-delete-asset="${esc(a.id)}" aria-label="Delete asset ${esc(a.tag)}">Delete</button>
      </div></td>
    </tr>`).join("");
  $("assetsEmpty").hidden = rows.length > 0;
}

function renderAll() { renderDashboard(); renderTickets(); renderAssets(); }

/* ------------------------------------------------------------------ */
/* View switching                                                      */
/* ------------------------------------------------------------------ */

const VIEW_META = {
  dashboard: ["Dashboard overview", "Live operational picture — tickets, assets and compliance."],
  tickets: ["Tickets", "Create, track and resolve support tickets."],
  assets: ["Assets", "Device inventory, assignment and compliance."]
};

function switchView(name) {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    const active = btn.dataset.view === name;
    btn.classList.toggle("is-active", active);
    if (active) btn.setAttribute("aria-current", "page"); else btn.removeAttribute("aria-current");
  });
  ["dashboard", "tickets", "assets"].forEach((v) => { $("view-" + v).hidden = v !== name; });
  $("viewTitle").textContent = VIEW_META[name][0];
  $("viewSubtitle").textContent = VIEW_META[name][1];
  $("quickAddBtn").textContent = name === "assets" ? "+ New asset" : "+ New ticket";
  if (name === "dashboard") renderDashboard(); // re-draw charts at correct width
}

/* ------------------------------------------------------------------ */
/* Tickets CRUD                                                        */
/* ------------------------------------------------------------------ */

function openTicketDialog(ticket) {
  $("ticketDialogTitle").textContent = ticket ? `Edit ${ticket.id}` : "New ticket";
  $("ticketId").value = ticket ? ticket.id : "";
  $("ticketTitle").value = ticket ? ticket.title : "";
  $("ticketDescription").value = ticket ? ticket.description || "" : "";
  $("ticketRequester").value = ticket ? ticket.requester : "";
  $("ticketAssignee").value = ticket ? ticket.assignee : "";
  $("ticketStatus").value = ticket ? ticket.status : "Open";
  $("ticketPriority").value = ticket ? ticket.priority : "Medium";
  $("ticketResolution").value = ticket && typeof ticket.resolutionHours === "number" ? ticket.resolutionHours : "";
  $("ticketError").hidden = true;
  $("ticketDialog").showModal();
}

function handleTicketSubmit(event) {
  event.preventDefault();
  const title = $("ticketTitle").value.trim();
  const requester = $("ticketRequester").value.trim();
  const assignee = $("ticketAssignee").value.trim();
  if (!title || !requester || !assignee) { $("ticketError").hidden = false; return; }

  const status = $("ticketStatus").value;
  const rawHours = $("ticketResolution").value;
  const resolutionHours = (status === "Resolved" || status === "Closed") && rawHours !== ""
    ? Math.max(0, Number(rawHours) || 0) : null;

  const id = $("ticketId").value;
  if (id) {
    const t = state.tickets.find((x) => x.id === id);
    if (t) Object.assign(t, {
      title, requester, assignee, status,
      priority: $("ticketPriority").value,
      description: $("ticketDescription").value.trim(),
      resolutionHours
    });
    showToast(`Ticket ${id} updated.`);
  } else {
    const newId = `TCK-${state.ticketSeq++}`;
    state.tickets.push({
      id: newId, title, requester, assignee, status,
      priority: $("ticketPriority").value,
      description: $("ticketDescription").value.trim(),
      createdAt: Date.now(), resolutionHours
    });
    showToast(`Ticket ${newId} created.`);
  }
  saveState(); renderAll(); $("ticketDialog").close();
}

function deleteTicket(id) {
  const t = state.tickets.find((x) => x.id === id);
  if (!t || !window.confirm(`Delete ticket ${id} — “${t.title}”?`)) return;
  state.tickets = state.tickets.filter((x) => x.id !== id);
  saveState(); renderAll(); showToast(`Ticket ${id} deleted.`);
}

/* ------------------------------------------------------------------ */
/* Assets CRUD                                                         */
/* ------------------------------------------------------------------ */

function openAssetDialog(asset) {
  $("assetDialogTitle").textContent = asset ? `Edit ${asset.tag}` : "New asset";
  $("assetId").value = asset ? asset.id : "";
  $("assetTag").value = asset ? asset.tag : "";
  $("assetDevice").value = asset ? asset.device : "";
  $("assetType").value = asset ? asset.type : "Laptop";
  $("assetAssigned").value = asset ? asset.assignedTo : "";
  $("assetStatus").value = asset ? asset.status : "In Use";
  $("assetCompliance").value = asset ? asset.compliance : "Compliant";
  $("assetError").hidden = true;
  $("assetDialog").showModal();
}

function handleAssetSubmit(event) {
  event.preventDefault();
  const tag = $("assetTag").value.trim();
  const device = $("assetDevice").value.trim();
  if (!tag || !device) { $("assetError").hidden = false; return; }

  const fields = {
    tag, device,
    type: $("assetType").value,
    assignedTo: $("assetAssigned").value.trim(),
    status: $("assetStatus").value,
    compliance: $("assetCompliance").value
  };
  const id = $("assetId").value;
  if (id) {
    const a = state.assets.find((x) => x.id === id);
    if (a) Object.assign(a, fields);
    showToast(`Asset ${tag} updated.`);
  } else {
    state.assets.push({ id: `AST-${String(state.assetSeq++).padStart(2, "0")}`, ...fields });
    showToast(`Asset ${tag} added.`);
  }
  saveState(); renderAll(); $("assetDialog").close();
}

function deleteAsset(id) {
  const a = state.assets.find((x) => x.id === id);
  if (!a || !window.confirm(`Delete asset ${a.tag} — ${a.device}?`)) return;
  state.assets = state.assets.filter((x) => x.id !== id);
  saveState(); renderAll(); showToast(`Asset ${a.tag} deleted.`);
}

/* ------------------------------------------------------------------ */
/* Wiring                                                              */
/* ------------------------------------------------------------------ */

function init() {
  document.querySelectorAll(".nav-item").forEach((btn) =>
    btn.addEventListener("click", () => switchView(btn.dataset.view)));
  document.querySelectorAll("[data-goto]").forEach((btn) =>
    btn.addEventListener("click", () => switchView(btn.dataset.goto)));

  $("quickAddBtn").addEventListener("click", () => {
    const assetsVisible = !$("view-assets").hidden;
    if (assetsVisible) openAssetDialog(null); else openTicketDialog(null);
  });
  $("addTicketBtn").addEventListener("click", () => openTicketDialog(null));
  $("addAssetBtn").addEventListener("click", () => openAssetDialog(null));
  $("resetDataBtn").addEventListener("click", () => {
    if (!window.confirm("Reset all tickets and assets back to the original demo data?")) return;
    state = seedState(); saveState(); renderAll(); showToast("Demo data restored.");
  });

  ["ticketSearch", "ticketStatusFilter", "ticketPriorityFilter"].forEach((id) =>
    $(id).addEventListener("input", renderTickets));
  ["assetSearch", "assetStatusFilter", "assetComplianceFilter"].forEach((id) =>
    $(id).addEventListener("input", renderAssets));

  $("ticketForm").addEventListener("submit", handleTicketSubmit);
  $("assetForm").addEventListener("submit", handleAssetSubmit);
  document.querySelectorAll("[data-close-dialog]").forEach((btn) =>
    btn.addEventListener("click", () => btn.closest("dialog").close()));

  // Delegated edit/delete buttons (tables are re-rendered, so listen on tbody)
  $("ticketsBody").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-ticket]");
    const del = e.target.closest("[data-delete-ticket]");
    if (edit) openTicketDialog(state.tickets.find((t) => t.id === edit.dataset.editTicket));
    if (del) deleteTicket(del.dataset.deleteTicket);
  });
  $("assetsBody").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-asset]");
    const del = e.target.closest("[data-delete-asset]");
    if (edit) openAssetDialog(state.assets.find((a) => a.id === edit.dataset.editAsset));
    if (del) deleteAsset(del.dataset.deleteAsset);
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderDashboard, 150);
  });

  renderAll();
}

document.addEventListener("DOMContentLoaded", init);
