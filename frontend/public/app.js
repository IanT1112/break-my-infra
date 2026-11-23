const DASHBOARD_URL =
  "/grafana/d/ag545cqyrf30gb/break-my-infra?orgId=1&from=now-5m&to=now&refresh=5s&kiosk&theme=dark";

const LABELS = {
  traffic: "🚀 Pico de tráfico",
  errors: "💥 Inyectando errores",
  latency: "🐢 Base de datos lenta",
};

const buttons = document.querySelectorAll(".chaos");
const statusBox = document.getElementById("status");
const label = document.getElementById("status-label");
const detail = document.getElementById("status-detail");
const countdown = document.getElementById("countdown");

document.getElementById("grafana").src = DASHBOARD_URL;

// ─── Activar un escenario ───
async function trigger(scenario) {
  buttons.forEach((b) => (b.disabled = true));
  try {
    const res = await fetch(`/api/chaos/${scenario}`, { method: "POST" });
    if (res.status === 409) detail.textContent = "Ya hay un escenario activo, espera a que termine";
    else if (!res.ok) detail.textContent = "No se pudo activar el escenario";
  } catch {
    detail.textContent = "Sin conexión con la API";
  }
  refresh();
}

// ─── Pintar el estado ───
function render({ active, remaining }) {
  const isActive = Boolean(active);
  statusBox.dataset.state = isActive ? "active" : "idle";

  buttons.forEach((b) => {
    b.disabled = isActive;
    b.classList.toggle("is-active", b.dataset.scenario === active);
  });

  if (isActive) {
    label.textContent = LABELS[active] ?? active;
    detail.textContent = "Mira cómo reaccionan los gráficos →";
    countdown.textContent = `${remaining}s`;
  } else {
    label.textContent = "Sistema estable";
    detail.textContent = "Elige un escenario para empezar";
    countdown.textContent = "";
  }
}

// ─── Consultar el estado cada segundo ───
async function refresh() {
  try {
    const res = await fetch("/api/chaos/status");
    render(await res.json());
  } catch {
    // la API puede estar reiniciando; reintentamos en el próximo ciclo
  }
}

buttons.forEach((b) => b.addEventListener("click", () => trigger(b.dataset.scenario)));
refresh();
setInterval(refresh, 1000);