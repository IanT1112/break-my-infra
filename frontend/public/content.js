// Textos de tooltips y ventanas. Separados de la lógica para editarlos fácil.

const TIPS = {
  devops: "Cultura y prácticas que unen desarrollo y operación en un ciclo continuo: planificar, construir, desplegar, operar y monitorear. Clic para saber más.",
  project: "Todo sistema falla. Esta demo te deja provocar fallos reales y ver cómo se detectan y se recuperan solos, con métricas, logs y trazas.",
};

const MODALS = {
  devops: {
    eyebrow: "Contexto",
    title: "¿Por qué DevOps?",
    sections: [
      ["Qué es", "DevOps es una forma de trabajar que une a quienes desarrollan el software con quienes lo mantienen en producción. En lugar de “lanzar y olvidar”, el código recorre un ciclo continuo: planificar, codificar, construir, probar, liberar, desplegar, operar y monitorear. Lo que se observa en producción vuelve como aprendizaje a la siguiente iteración."],
      ["Por qué importa", "Permite entregar cambios más seguido y con menos riesgo. Se apoya en la automatización (CI/CD), la infraestructura como código y la observabilidad, y se mide con indicadores como el MTTD (tiempo en detectar un fallo) y el MTTR (tiempo en recuperarse)."],
      ["Tecnologías en la nube", "Hoy casi todo se despliega en la nube: AWS, Azure o Google Cloud ofrecen servidores, bases de datos y redes bajo demanda. Las piezas clave son los contenedores (Docker), los orquestadores (Kubernetes), la infraestructura como código (Terraform), los pipelines de CI/CD (GitHub Actions, GitLab CI) y el stack de observabilidad (Prometheus, Grafana, OpenTelemetry)."],
      ["La carrera", "Es uno de los perfiles más demandados en tecnología. Los roles más comunes son DevOps Engineer, Site Reliability Engineer (SRE), Cloud Engineer y Platform Engineer. La base es Linux, redes, scripting (Bash o Python), Git y contenedores; después vienen la nube, Kubernetes, Terraform y la observabilidad. Las certificaciones como AWS Solutions Architect o CKA ayudan, pero los proyectos prácticos como este son los que más pesan."],
    ],
  },
  project: {
    eyebrow: "Contexto",
    title: "¿Por qué este proyecto?",
    sections: [
      ["La idea", "Todo sistema falla tarde o temprano. Lo que distingue a un equipo maduro es cuánto tarda en enterarse y en recuperarse. Break My Infra lo hace visible: tú provocas el fallo y ves cómo reacciona la infraestructura."],
      ["Qué demuestra", "Una arquitectura de microservicios real (gateway, orders y payments), instrumentada con las tres señales de observabilidad: métricas, logs y trazas. Cada escenario de caos se desactiva solo a los 45 segundos, sin intervención manual."],
      ["Qué mirar", "La latencia p95 cruza el umbral de 500 ms, la tasa de errores sube y en los logs aparecen los fallos en vivo. Al terminar el escenario, todo vuelve a la normalidad por sí solo."],
    ],
  },
};

const TECH = [
  {
    id: "fastapi", name: "FastAPI", role: "Servicios",
    short: "Framework web de Python, ligero y asíncrono. Ideal para microservicios que generan tráfico real.",
    how: "Los tres microservicios (gateway, orders y payments) están escritos en FastAPI. El gateway recibe los pedidos y expone la API de caos que usa este panel.",
    why: "Es rápido, soporta async de forma nativa y genera documentación automática. Permite simular cientos de requests concurrentes con muy poco código.",
    more: "Está construido sobre Starlette y Pydantic. Es uno de los frameworks de Python más usados para APIs modernas.",
  },
  {
    id: "redis", name: "Redis", role: "Motor de caos",
    short: "Base de datos en memoria. Guarda qué escenario de caos está activo y lo apaga solo.",
    how: "Cuando activas un escenario, el gateway guarda una clave en Redis con un TTL de 45 segundos. Todos los servicios la consultan para saber si deben fallar o volverse lentos.",
    why: "Lo comparten todos los servicios y el TTL hace que el caos expire automáticamente, sin procesos extra.",
    more: "Redis se usa mucho como caché, cola de mensajes y almacén de sesiones gracias a sus tiempos de respuesta por debajo del milisegundo.",
  },
  {
    id: "docker", name: "Docker Compose", role: "Orquestación",
    short: "Levanta los 11 contenedores del sistema con un solo comando.",
    how: "Un único docker-compose.yml define los servicios, la observabilidad y el proxy. Con `docker compose up` se levanta todo.",
    why: "Da un entorno reproducible: corre igual en cualquier máquina, sin instalar nada a mano.",
    more: "En producción, este mismo modelo de contenedores suele llevarse a Kubernetes o a servicios gestionados como AWS ECS.",
  },
  {
    id: "nginx", name: "nginx", role: "Puerta de entrada",
    short: "Sirve este panel y enruta las peticiones a la API y a Grafana.",
    how: "Sirve los archivos estáticos del panel, redirige /api/ al gateway y /grafana/ a Grafana, incluido el WebSocket para el refresco en vivo.",
    why: "Deja un solo punto público y mantiene privado todo lo demás. Además evita problemas de CORS.",
    more: "Es uno de los servidores web y proxies inversos más usados del mundo, conocido por su bajo consumo y alto rendimiento.",
  },
  {
    id: "otel", name: "OpenTelemetry", role: "Instrumentación",
    short: "Estándar abierto para generar trazas y propagar el contexto entre servicios.",
    how: "Cada servicio crea spans para sus operaciones y propaga el trace_id en las cabeceras HTTP. Así se reconstruye el recorrido completo de cada pedido.",
    why: "Es un estándar abierto: no te ata a ningún proveedor y funciona con Tempo, Jaeger, Datadog y otros.",
    more: "Es un proyecto de la CNCF que unifica métricas, logs y trazas bajo una misma API y un mismo SDK.",
  },
  {
    id: "alloy", name: "Grafana Alloy", role: "Colector",
    short: "Agente que recoge los logs de los contenedores y recibe las trazas.",
    how: "Lee los logs de Docker, los etiqueta por servicio y los envía a Loki. También recibe las trazas OTLP y las reenvía a Tempo.",
    why: "Un solo agente para todas las señales, sin tocar el código de los servicios.",
    more: "Es el sucesor de Grafana Agent y es compatible con los pipelines de OpenTelemetry Collector.",
  },
  {
    id: "prometheus", name: "Prometheus", role: "Métricas",
    short: "Consulta cada 5 s las métricas de todos los servicios y calcula p95 y errores.",
    how: "Hace scraping del endpoint /metrics de cada servicio. Con PromQL se calculan la latencia p95, los requests por segundo y la tasa de errores que ves a la derecha.",
    why: "Es el estándar de la industria para métricas, con un lenguaje de consulta potente y un ecosistema enorme.",
    more: "Nació en SoundCloud y fue el segundo proyecto graduado de la CNCF, después de Kubernetes.",
  },
  {
    id: "loki", name: "Loki", role: "Logs",
    short: "Almacena los logs en JSON y los consulta por etiquetas. Barato a gran escala.",
    how: "Recibe los logs estructurados de los servicios. El panel “Errores en vivo” filtra con LogQL los que tienen nivel de error.",
    why: "Solo indexa etiquetas, no el texto completo, así que cuesta mucho menos que soluciones como Elasticsearch.",
    more: "Se diseñó como “Prometheus para logs”: usa el mismo modelo de etiquetas y se integra nativamente con Grafana.",
  },
  {
    id: "tempo", name: "Tempo", role: "Trazas",
    short: "Guarda el recorrido de cada request entre servicios y muestra el cuello de botella.",
    how: "Almacena las trazas que generan los servicios. Desde Grafana puedes abrir una traza y ver cuánto tardó cada salto: gateway → orders → payments.",
    why: "Muestra en segundos qué servicio es el lento, algo imposible de ver solo con métricas.",
    more: "Solo necesita almacenamiento de objetos (como S3), lo que lo hace muy barato de operar.",
  },
  {
    id: "grafana", name: "Grafana", role: "Visualización",
    short: "Los cuadros de monitoreo que ves a la derecha. Une métricas, logs y trazas.",
    how: "Tiene configurados Prometheus, Loki y Tempo como fuentes de datos. Los cuatro paneles de la derecha están embebidos desde un mismo dashboard.",
    why: "Une las tres señales en una sola pantalla y permite saltar de una métrica a sus logs y trazas.",
    more: "Es la herramienta de visualización open source más usada para observabilidad, con cientos de integraciones.",
  },
  {
    id: "aws", name: "AWS + Terraform", role: "Próximamente", soon: true,
    short: "Próximamente: desplegar todo en la nube con infraestructura como código.",
    how: "El siguiente paso es llevar esta misma arquitectura a AWS, definiendo toda la infraestructura con Terraform.",
    why: "La infraestructura queda versionada, es reproducible y se puede destruir con un comando, lo que mantiene los costos bajo control.",
    more: "Terraform, de HashiCorp, permite describir la infraestructura de cualquier nube en archivos declarativos (HCL).",
  },
];
