const DASHBOARD_URL =
  "/grafana/d/ag545cqyrf30gb/break-my-infra?orgId=1&from=now-5m&to=now&refresh=5s&kiosk&autofitpanels&theme=light&_dash.hideTimePicker";

const LABELS = {
  traffic: "Pico de tráfico",
  errors: "Inyectando errores",
  latency: "Base de datos lenta",
};

const buttons = document.querySelectorAll(".chaos");
const noticeEl = document.getElementById("notice");

// ─── Monitoreo 2x2 ───
document.getElementById("grafana").src = DASHBOARD_URL;

// ─── Lista de tecnologías ───
const techList = document.getElementById("tech-list");
TECH.forEach((t) => {
  const li = document.createElement("li");
  li.innerHTML = `<button class="tech${t.soon ? " is-soon" : ""}" data-tech="${t.id}">
      <span>${t.name}</span><small>${t.role}</small></button>`;
  techList.appendChild(li);
});

// ─── Tooltip flotante a la derecha ───
const tip = document.getElementById("tip");

function showTip(el, text) {
  tip.textContent = text;
  tip.hidden = false;
  const r = el.getBoundingClientRect();
  const tr = tip.getBoundingClientRect();
  let left = r.right + 14;
  if (left + tr.width > innerWidth - 12) left = Math.max(12, r.left - tr.width - 14);
  const top = Math.min(Math.max(12, r.top + r.height / 2 - tr.height / 2), innerHeight - tr.height - 12);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  tip.classList.add("is-visible");
}
function hideTip() {
  tip.classList.remove("is-visible");
  tip.hidden = true;
}

function tipText(el) {
  if (el.dataset.tipKey) return TIPS[el.dataset.tipKey];
  if (el.dataset.tech) return TECH.find((t) => t.id === el.dataset.tech).short;
}

document.querySelectorAll("[data-tip-key], [data-tech]").forEach((el) => {
  el.addEventListener("mouseenter", () => showTip(el, tipText(el)));
  el.addEventListener("focus", () => showTip(el, tipText(el)));
  el.addEventListener("mouseleave", hideTip);
  el.addEventListener("blur", hideTip);
});

// ─── Ventana efecto espejo ───
const modal = document.getElementById("modal");
const mEyebrow = document.getElementById("modal-eyebrow");
const mTitle = document.getElementById("modal-title");
const mBody = document.getElementById("modal-body");

function openModal({ eyebrow, title, sections }) {
  hideTip();
  mEyebrow.textContent = eyebrow;
  mTitle.textContent = title;
  mBody.replaceChildren(
    ...sections.map(([h, p]) => {
      const s = document.createElement("section");
      s.innerHTML = `<h3></h3><p></p>`;
      s.querySelector("h3").textContent = h;
      s.querySelector("p").textContent = p;
      return s;
    })
  );
  modal.showModal();
  mBody.scrollTop = 0;
}

document.querySelectorAll("[data-modal]").forEach((el) =>
  el.addEventListener("click", () => openModal(MODALS[el.dataset.modal]))
);

document.querySelectorAll("[data-tech]").forEach((el) =>
  el.addEventListener("click", () => {
    const t = TECH.find((x) => x.id === el.dataset.tech);
    openModal({
      eyebrow: t.role,
      title: t.name,
      sections: [
        ["Cómo se usa aquí", t.how],
        ["Por qué se eligió", t.why],
        ["Más sobre la tecnología", t.more],
      ],
    });
  })
);

document.getElementById("modal-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.close(); // clic fuera de la ventana
});

// ─── Caos: mensajes temporales que render() no pisa ───
let notice = null;
let noticeUntil = 0;
function showNotice(text) {
  notice = text;
  noticeUntil = Date.now() + 4000;
}

async function trigger(scenario) {
  buttons.forEach((b) => (b.disabled = true));
  try {
    const res = await fetch(`/api/chaos/${scenario}`, { method: "POST" });
    if (res.status === 401) {
      sessionEnd = 0;
      showGate("Tu sesión terminó", "Inicia una nueva para seguir probando.", "Iniciar demo");
    }
    else if (res.status === 409) showNotice("Ya hay un escenario activo, espera a que termine");
    else if (res.status === 429) showNotice("Demasiados intentos, espera un minuto");
    else if (!res.ok) showNotice("No se pudo activar el escenario");
  } catch {
    showNotice("Sin conexión con la API");
  }
  refresh();
}

function render({ active, remaining }) {
  const isActive = Boolean(active);

  buttons.forEach((b) => {
    const mine = b.dataset.scenario === active;
    b.disabled = isActive;
    b.classList.toggle("is-active", mine);
    b.querySelector(".count").textContent = mine ? `${remaining}s` : "";
  });

  noticeEl.textContent =
    notice && Date.now() < noticeUntil
      ? notice
      : isActive
        ? `${LABELS[active] ?? active} activo · mira cómo reaccionan los gráficos`
        : "";
}

async function refresh() {
  try {
    const res = await fetch("/api/chaos/status");
    if (res.ok) render(await res.json());
  } catch {
    // la API puede estar reiniciando; reintentamos en el próximo ciclo
  }
}

buttons.forEach((b) => b.addEventListener("click", () => trigger(b.dataset.scenario)));
refresh();
setInterval(refresh, 1000);

// ─── Sesión de demo (20 min, máx. 3 personas) ───
const gate = document.createElement("div");
gate.className = "gate";
gate.innerHTML = `
  <div class="gate-card">
    <p class="gate-eyebrow">Demo en vivo</p>
    <h2 id="gate-title"></h2>
    <p id="gate-text"></p>
    <button id="gate-btn" class="gate-btn"></button>
  </div>`;
document.body.appendChild(gate);

const pill = document.createElement("div");
pill.className = "session-pill";
pill.hidden = true;
document.body.appendChild(pill);

const gateTitle = gate.querySelector("#gate-title");
const gateText = gate.querySelector("#gate-text");
const gateBtn = gate.querySelector("#gate-btn");

let sessionEnd = 0;
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mins = (s) => `${Math.ceil(s / 60)} min`;

function showGate(title, text, buttonLabel) {
  gateTitle.textContent = title;
  gateText.textContent = text;
  gateBtn.hidden = !buttonLabel;
  if (buttonLabel) gateBtn.textContent = buttonLabel;
  gate.hidden = false;
  pill.hidden = true;
}

function startCountdown(remaining) {
  sessionEnd = Date.now() + remaining * 1000;
  gate.hidden = true;
  pill.hidden = false;
}

// Contador de la sesión
setInterval(() => {
  if (!sessionEnd) return;
  const left = Math.max(0, Math.round((sessionEnd - Date.now()) / 1000));
  pill.textContent = `Tu sesión · ${mmss(left)}`;
  if (left === 0) {
    sessionEnd = 0;
    showGate("¡Gracias por probar la demo! 👋", "Tu sesión de 20 minutos terminó.", null);
  }
}, 1000);

async function startSession() {
  gateBtn.disabled = true;
  try {
    const res = await fetch("/api/session", { method: "POST" });
    const data = await res.json().catch(() => ({})); // el 429 de nginx no es JSON
    if (res.ok) return startCountdown(data.remaining);

    const reason = data.detail?.reason;
    const retry = mins(data.detail?.retry_in ?? 60);
    if (reason === "full")
      showGate("La demo está llena", `Hay 3 personas usándola ahora. Vuelve en ~${retry}.`, "Reintentar");
    else if (reason === "cooldown")
      showGate("Ya probaste la demo", `Podrás volver a usarla en ~${retry}.`, null);
    else
      showGate("Demasiados intentos", "Espera un momento y vuelve a intentar.", "Reintentar");
  } catch {
    showGate("Sin conexión", "No pudimos contactar con el servidor.", "Reintentar");
  } finally {
    gateBtn.disabled = false;
  }
}

gateBtn.addEventListener("click", startSession);

// Al cargar: ¿ya tengo una sesión activa? (por ejemplo, si recargué la página)
(async () => {
  try {
    const res = await fetch("/api/session");
    const data = await res.json();
    if (data.active) return startCountdown(data.remaining);
  } catch {}
  showGate(
    "Rompe el sistema durante 20 minutos",
    "Máximo 3 personas a la vez, para que la demo funcione bien para todos.",
    "Iniciar demo"
  );
})();