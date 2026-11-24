#!/bin/bash
set -euxo pipefail

# Swap de 2 GB: colchón de memoria para una máquina de 2 GB de RAM
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Docker + docker compose (instalador oficial)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
usermod -aG docker ubuntu