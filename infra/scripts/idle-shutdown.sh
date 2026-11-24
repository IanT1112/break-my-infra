#!/bin/bash
# Apaga la EC2 cuando nadie la usa (scale-to-zero 💰)
IDLE_MINUTES=10
MAX_UPTIME_MINUTES=60

uptime_min=$(( $(cut -d. -f1 /proc/uptime) / 60 ))

# 1) Tope duro: nunca más de 1 h encendida por arranque
if [ "$uptime_min" -ge "$MAX_UPTIME_MINUTES" ]; then
  logger -t idle-shutdown "tope de ${MAX_UPTIME_MINUTES} min alcanzado, apagando"
  shutdown -h now
  exit 0
fi

# 2) Gracia al arrancar: dar tiempo a que alguien entre
if [ "$uptime_min" -lt "$IDLE_MINUTES" ]; then
  exit 0
fi

# 3) ¿Hubo visitas reales en nginx? (solo stdout = access log; los errores no cuentan)
hits=$(docker logs --since "${IDLE_MINUTES}m" break-my-infra-web-1 2>/dev/null | wc -l)

if [ "$hits" -eq 0 ]; then
  logger -t idle-shutdown "sin visitas en ${IDLE_MINUTES} min, apagando"
  shutdown -h now
fi