// Dashboard completo en kiosk (ya está maquetado 2x2). Los paneles sueltos (d-solo)
// no respetan refresh=5s en Grafana 11, por eso no se usan.
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
    if (res.status === 409) showNotice("Ya hay un escenario activo, espera a que termine");
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
