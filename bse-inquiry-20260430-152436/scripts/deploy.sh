#!/usr/bin/env bash
#
# deploy.sh — 服务器端部署脚本
#
# 用法（在解压后的包目录中执行）:
#   bash scripts/deploy.sh              # 完整部署
#   bash scripts/deploy.sh --backend    # 仅更新后端
#   bash scripts/deploy.sh --frontend   # 仅更新前端
#
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 读取配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "错误: 未找到 $CONF_FILE"
    exit 1
fi
source "$CONF_FILE"

# 参数解析
DEPLOY_BACKEND=true
DEPLOY_FRONTEND=true
for arg in "$@"; do
    case "$arg" in
        --backend)  DEPLOY_FRONTEND=false ;;
        --frontend) DEPLOY_BACKEND=false ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

# 检测包内容
if [ ! -d "$PACKAGE_DIR/backend/app" ]; then
    echo "错误: 未找到 backend/app 目录"
    exit 1
fi

echo "=============================="
echo "  BSE 年报审查系统 - 部署"
echo "  目标: $DEPLOY_DIR"
echo "  时间: $TIMESTAMP"
echo "=============================="

# Step 1: 准备目录
echo ""
echo "[1/6] 准备目录..."
mkdir -p "$DEPLOY_DIR"/{data,backend/logs,backend/uploads}

# Step 2: 部署后端（仅替换 app/ 子目录）
if [ "$DEPLOY_BACKEND" = true ]; then
    echo ""
    echo "[2/6] 部署后端..."

    # backup 旧的 app/ 目录
    if [ -d "$DEPLOY_DIR/backend/app" ]; then
        mv "$DEPLOY_DIR/backend/app" "$DEPLOY_DIR/backend/app_${TIMESTAMP}"
        echo "  已备份: backend/app → backend/app_${TIMESTAMP}"
    fi

    # 放入新的 app/ 目录
    cp -r "$PACKAGE_DIR/backend/app" "$DEPLOY_DIR/backend/app"
    cp "$PACKAGE_DIR/backend/requirements.txt" "$DEPLOY_DIR/backend/requirements.txt"

    # 首次部署: 复制 .env 模板
    if [ ! -f "$DEPLOY_DIR/backend/.env" ] && [ -f "$PACKAGE_DIR/backend/.env" ]; then
        cp "$PACKAGE_DIR/backend/.env" "$DEPLOY_DIR/backend/.env"
        echo "  已创建: backend/.env（首次部署，从模板复制）"
    fi

    echo "  后端代码已更新"
else
    echo ""
    echo "[2/6] 跳过后端部署"
fi

# Step 3: 部署前端（整体替换）
if [ "$DEPLOY_FRONTEND" = true ]; then
    echo ""
    echo "[3/6] 部署前端..."

    if [ -d "$DEPLOY_DIR/frontend" ]; then
        mv "$DEPLOY_DIR/frontend" "$DEPLOY_DIR/frontend_${TIMESTAMP}"
        echo "  已备份: frontend → frontend_${TIMESTAMP}"
    fi

    cp -r "$PACKAGE_DIR/frontend" "$DEPLOY_DIR/frontend"
    echo "  前端已更新"
else
    echo ""
    echo "[3/6] 跳过前端部署"
fi

# Step 4: 覆盖非核心文件
echo ""
echo "[4/6] 同步文档和脚本..."
[ -d "$PACKAGE_DIR/plan" ] && rm -rf "$DEPLOY_DIR/plan" && cp -r "$PACKAGE_DIR/plan" "$DEPLOY_DIR/plan"
[ -d "$PACKAGE_DIR/scripts" ] && rm -rf "$DEPLOY_DIR/scripts" && cp -r "$PACKAGE_DIR/scripts" "$DEPLOY_DIR/scripts"
[ -f "$PACKAGE_DIR/.gitignore" ] && cp "$PACKAGE_DIR/.gitignore" "$DEPLOY_DIR/.gitignore"
[ -f "$PACKAGE_DIR/README.md" ] && cp "$PACKAGE_DIR/README.md" "$DEPLOY_DIR/README.md"
echo "  plan/ scripts/ 已同步"

# Step 5: Docker 后端容器
echo ""
echo "[5/6] 配置服务..."

# Nginx 配置
if [ ! -f "$NGINX_CONF" ] || [ "$DEPLOY_FRONTEND" = true ]; then
    sed -e "s|{{NGINX_PORT}}|${NGINX_PORT}|g" \
        -e "s|{{BACKEND_PORT}}|${BACKEND_PORT}|g" \
        -e "s|{{DEPLOY_DIR}}|${DEPLOY_DIR}|g" \
        "$PACKAGE_DIR/scripts/bse.conf" > "$NGINX_CONF"
    echo "  Nginx 配置已更新 (端口 ${NGINX_PORT})"
fi
# 重载 Nginx（兼容 systemd 和直接启动两种方式）
if nginx -t 2>&1; then
    if systemctl is-active --quiet nginx 2>/dev/null; then
        systemctl reload nginx && echo "  Nginx 已重载 (systemd)"
    else
        nginx -s reload 2>/dev/null && echo "  Nginx 已重载 (signal)" || true
    fi
fi

# 停掉旧的 systemd 服务（如果存在）
if systemctl is-active --quiet "bse-backend" 2>/dev/null; then
    systemctl stop bse-backend
    systemctl disable bse-backend 2>/dev/null
    echo "  已停用旧 systemd 服务"
fi

# 后端服务管理（进容器操作，不操作容器本身）
#
# 设计理念: 容器 = 运行环境，deploy.sh 只进容器操作服务
# 前提: 容器已存在且运行中（容器创建是一次性基础设施操作，见部署文档 5.2.1）
# 重启机制: pkill uvicorn → 容器退出 → --restart unless-stopped 自动重启 → CMD 重新执行
#
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "  错误: 容器 ${CONTAINER_NAME} 未运行"
    echo "  请先创建并启动容器（参见部署文档「5.2.1 首次环境初始化」）"
    exit 1
fi

if [ "$DEPLOY_BACKEND" = true ]; then
    # 安装/更新 Python 依赖
    echo "  安装依赖..."
    docker exec "$CONTAINER_NAME" pip install --quiet -r "${DEPLOY_DIR}/backend/requirements.txt"

    # 重启 uvicorn（pkill → 容器自动重启 → 加载新代码和依赖）
    echo "  重启后端服务..."
    docker exec "$CONTAINER_NAME" pkill -f 'uvicorn app.main:app' 2>/dev/null || true
    sleep 5

    # 等待容器自动重启完成
    for i in 1 2 3; do
        if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Status}}' | grep -q "Up"; then
            break
        fi
        sleep 2
    done
fi

if docker ps --filter "name=${CONTAINER_NAME}" --format '{{.Status}}' | grep -q "Up"; then
    echo "  后端服务已重启 (${CONTAINER_NAME})"
else
    echo "  警告: 容器未运行，查看: docker logs ${CONTAINER_NAME}"
fi

# Step 6: 健康检查
echo ""
echo "[6/6] 健康检查..."
if curl -sf --max-time 10 "http://127.0.0.1:${BACKEND_PORT}/" > /dev/null 2>&1; then
    echo "  [OK] 后端 API (127.0.0.1:${BACKEND_PORT})"
else
    echo "  [--] 后端 API 未响应（可能需要更长启动时间）"
fi
if curl -sf -o /dev/null "http://127.0.0.1:${NGINX_PORT}/"; then
    echo "  [OK] 前端页面 (0.0.0.0:${NGINX_PORT})"
else
    echo "  [--] 前端页面未响应"
fi

echo ""
echo "=============================="
echo "  部署完成!"
echo "  访问: http://$(hostname -I | awk '{print $1}'):${NGINX_PORT}"
echo "  容器: docker logs ${CONTAINER_NAME}"
echo "=============================="
