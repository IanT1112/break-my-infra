#!/bin/bash
set -euxo pipefail

# 1) Swap de 2 GB: colchón de memoria para una máquina de 2 GB de RAM
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 2) Docker + docker compose (instalador oficial)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
usermod -aG docker ubuntu

# 3) Código + stack completo
git clone https://github.com/IanT1112/break-my-infra.git /opt/break-my-infra
cd /opt/break-my-infra
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 4) Auto-apagado: revisar cada 2 minutos
install -m 755 /opt/break-my-infra/infra/scripts/idle-shutdown.sh /usr/local/bin/idle-shutdown.sh
echo '*/2 * * * * root /usr/local/bin/idle-shutdown.sh' > /etc/cron.d/idle-shutdown