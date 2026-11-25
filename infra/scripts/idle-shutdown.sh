#!/bin/bash
# Apaga la EC2 cuando nadie la usa (scale-to-zero 💰)
GRACE_MINUTES=20       # tiempo mínimo encendida (una sesión completa)
IDLE_MINUTES=5         # sin visitas durante este tiempo → apagar
MAX_UPTIME_MINUTES=60  # tope duro por encendido

uptime_min=$(( $(cut -d. -f1 /proc/uptime) / 60 ))
#ojito a los comentarios
# 1) Tope duro
if [ "$uptime_min" -ge "$MAX_UPTIME_MINUTES" ]; then
  logger -t idle-shutdown "tope de ${MAX_UPTIME_MINUTES} min alcanzado, apagando"
  shutdown -h now
  exit 0
fi

# 2) Los primeros 20 min, siempre encendida
if [ "$uptime_min" -lt "$GRACE_MINUTES" ]; then
  exit 0
fi

# 3) ¿Hubo visitas en los últimos 5 min?
hits=$(docker logs --since "${IDLE_MINUTES}m" break-my-infra-web-1 2>/dev/null | wc -l)

if [ "$hits" -eq 0 ]; then
  logger -t idle-shutdown "sin visitas en ${IDLE_MINUTES} min, apagando"
  shutdown -h now
fi