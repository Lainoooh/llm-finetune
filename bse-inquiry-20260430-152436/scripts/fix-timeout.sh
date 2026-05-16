#!/usr/bin/env bash
#
# fix-timeout.sh - 修复 504 超时问题
# 用法: bash scripts/fix-timeout.sh
#
set -euo pipefail

echo "=============================="
echo "  504 超时问题诊断与修复"
echo "  时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================="

# 读取配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONF_FILE="$SCRIPT_DIR/deploy.conf"

if [ ! -f "$CONF_FILE" ]; then
    echo "错误: 未找到 $CONF_FILE"
    exit 1
fi
source "$CONF_FILE"

# ============================================================
# 步骤 1: 诊断当前状态
# ============================================================
echo ""
echo "[1/5] 诊断当前状态..."

# 1.1 检查容器状态
echo ""
echo ">>> 容器状态:"
if docker ps --format '{{.Names}}\t{{.Status}}' | grep -q "^${CONTAINER_NAME}"; then
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E "NAMES|${CONTAINER_NAME}"
    CONTAINER_RUNNING=true
else
    echo "  [警告] 容器 ${CONTAINER_NAME} 未运行"
    CONTAINER_RUNNING=false
fi

# 1.2 检查容器启动命令
echo ""
echo ">>> 容器启动命令:"
if [ "$CONTAINER_RUNNING" = true ]; then
    CONTAINER_CMD=$(docker inspect ${CONTAINER_NAME} --format '{{.Config.Cmd}}' 2>/dev/null || echo "")
    echo "  $CONTAINER_CMD"

    if echo "$CONTAINER_CMD" | grep -q "timeout-keep-alive"; then
        TIMEOUT_VALUE=$(echo "$CONTAINER_CMD" | grep -oP 'timeout-keep-alive\s+\K\d+' || echo "未找到")
        echo "  [OK] uvicorn 超时已配置: ${TIMEOUT_VALUE}s"
        NEED_FIX_UVICORN=false
    else
        echo "  [问题] uvicorn 未配置 --timeout-keep-alive"
        NEED_FIX_UVICORN=true
    fi
else
    NEED_FIX_UVICORN=true
fi

# 1.3 检查 nginx 配置
echo ""
echo ">>> Nginx 超时配置:"
if [ -f "$NGINX_CONF" ]; then
    grep -E "proxy_read_timeout|proxy_send_timeout|proxy_connect_timeout" "$NGINX_CONF" || echo "  未找到超时配置"

    READ_TIMEOUT=$(grep "proxy_read_timeout" "$NGINX_CONF" | grep -oP '\d+' | head -1 || echo "60")
    if [ "$READ_TIMEOUT" -ge 600 ]; then
        echo "  [OK] proxy_read_timeout = ${READ_TIMEOUT}s"
        NEED_FIX_NGINX=false
    else
        echo "  [问题] proxy_read_timeout = ${READ_TIMEOUT}s (建议 >= 600s)"
        NEED_FIX_NGINX=true
    fi
else
    echo "  [警告] 未找到 nginx 配置文件: $NGINX_CONF"
    NEED_FIX_NGINX=false
fi

# 1.4 检查 LLM 模型配置
echo ""
echo ">>> LLM 模型配置:"
if [ "$CONTAINER_RUNNING" = true ]; then
    docker exec ${CONTAINER_NAME} sqlite3 ${DEPLOY_DIR}/data/bse.db << 'EOF' 2>/dev/null || echo "  [警告] 无法读取数据库"
.headers on
.mode column
SELECT id, model_name, endpoint_url,
       CASE WHEN api_key != '' THEN '已配置' ELSE '未配置' END as api_key_status,
       purpose, is_active
FROM models
WHERE is_active = 1;
EOF
else
    echo "  [跳过] 容器未运行"
fi

# 1.5 检查最近日志
echo ""
echo ">>> 最近错误日志 (最后 20 行):"
if [ "$CONTAINER_RUNNING" = true ]; then
    docker logs ${CONTAINER_NAME} --tail 20 2>&1 | grep -iE "error|timeout|failed|exception" || echo "  未发现明显错误"
else
    echo "  [跳过] 容器未运行"
fi

# ============================================================
# 步骤 2: 确认是否需要修复
# ============================================================
echo ""
echo "[2/5] 修复决策..."

if [ "$NEED_FIX_UVICORN" = false ] && [ "$NEED_FIX_NGINX" = false ]; then
    echo "  [结论] 超时配置正常，问题可能在其他地方"
    echo ""
    echo "建议检查:"
    echo "  1. LLM API endpoint 是否可访问"
    echo "  2. LLM API 是否真的超过 10 分钟"
    echo "  3. 查看完整日志: docker logs ${CONTAINER_NAME}"
    exit 0
fi

echo "  需要修复的项目:"
[ "$NEED_FIX_UVICORN" = true ] && echo "    - uvicorn 超时配置"
[ "$NEED_FIX_NGINX" = true ] && echo "    - nginx 超时配置"

# ============================================================
# 步骤 3: 修复 uvicorn 超时
# ============================================================
if [ "$NEED_FIX_UVICORN" = true ]; then
    echo ""
    echo "[3/5] 修复 uvicorn 超时配置..."

    # 停止旧容器
    if [ "$CONTAINER_RUNNING" = true ]; then
        echo "  停止旧容器..."
        docker stop ${CONTAINER_NAME}
        docker rm ${CONTAINER_NAME}
    fi

    # 重新创建容器（添加 --timeout-keep-alive 600）
    echo "  创建新容器（超时 600s）..."
    docker run -d \
      --name ${CONTAINER_NAME} \
      --restart unless-stopped \
      -p ${BACKEND_PORT}:8000 \
      -v ${DEPLOY_DIR}:${DEPLOY_DIR} \
      -v ${MODELS_DIR}:${MODELS_DIR} \
      -w ${DEPLOY_DIR}/backend \
      ${DOCKER_IMAGE} \
      uvicorn app.main:app --host 0.0.0.0 --port 8000 --timeout-keep-alive 600

    # 等待启动
    echo "  等待容器启动..."
    sleep 8

    # 检查状态
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "  [OK] 容器已启动"
    else
        echo "  [错误] 容器启动失败，查看日志:"
        docker logs ${CONTAINER_NAME} --tail 30
        exit 1
    fi
else
    echo ""
    echo "[3/5] 跳过 uvicorn 修复（已配置）"
fi

# ============================================================
# 步骤 4: 修复 nginx 超时
# ============================================================
if [ "$NEED_FIX_NGINX" = true ]; then
    echo ""
    echo "[4/5] 修复 nginx 超时配置..."

    # 备份原配置
    cp "$NGINX_CONF" "${NGINX_CONF}.backup.$(date +%Y%m%d-%H%M%S)"

    # 更新超时配置（300s → 600s）
    sed -i 's/proxy_read_timeout [0-9]\+s;/proxy_read_timeout 600s;/g' "$NGINX_CONF"
    sed -i 's/proxy_send_timeout [0-9]\+s;/proxy_send_timeout 600s;/g' "$NGINX_CONF"
    sed -i 's/proxy_connect_timeout [0-9]\+s;/proxy_connect_timeout 60s;/g' "$NGINX_CONF"

    echo "  已更新配置:"
    grep -E "proxy_read_timeout|proxy_send_timeout|proxy_connect_timeout" "$NGINX_CONF"

    # 测试配置
    if nginx -t 2>&1; then
        echo "  [OK] Nginx 配置测试通过"

        # 重载 nginx
        if systemctl is-active --quiet nginx 2>/dev/null; then
            systemctl reload nginx
            echo "  [OK] Nginx 已重载 (systemd)"
        else
            nginx -s reload 2>/dev/null
            echo "  [OK] Nginx 已重载 (signal)"
        fi
    else
        echo "  [错误] Nginx 配置测试失败"
        exit 1
    fi
else
    echo ""
    echo "[4/5] 跳过 nginx 修复（已配置）"
fi

# ============================================================
# 步骤 5: 验证修复结果
# ============================================================
echo ""
echo "[5/5] 验证修复结果..."

# 5.1 检查后端 API
echo ""
echo ">>> 后端 API 健康检查:"
sleep 3
if curl -sf --max-time 10 "http://127.0.0.1:${BACKEND_PORT}/" > /dev/null 2>&1; then
    RESPONSE=$(curl -s "http://127.0.0.1:${BACKEND_PORT}/")
    echo "  [OK] 后端 API 正常响应"
    echo "  响应: $RESPONSE"
else
    echo "  [警告] 后端 API 未响应（可能需要更长启动时间）"
    echo "  查看日志: docker logs ${CONTAINER_NAME}"
fi

# 5.2 检查前端
echo ""
echo ">>> 前端页面健康检查:"
if curl -sf -o /dev/null "http://127.0.0.1:${NGINX_PORT}/"; then
    echo "  [OK] 前端页面正常"
else
    echo "  [警告] 前端页面未响应"
fi

# 5.3 显示最终配置
echo ""
echo ">>> 最终超时配置:"
echo "  - httpx client: 600s (代码中已配置)"
echo "  - uvicorn: $(docker inspect ${CONTAINER_NAME} --format '{{.Config.Cmd}}' 2>/dev/null | grep -oP 'timeout-keep-alive\s+\K\d+' || echo '默认')s"
echo "  - nginx proxy_read_timeout: $(grep "proxy_read_timeout" "$NGINX_CONF" | grep -oP '\d+' | head -1 || echo '未知')s"

# ============================================================
# 完成
# ============================================================
echo ""
echo "=============================="
echo "  修复完成!"
echo "=============================="
echo ""
echo "访问地址: http://$(hostname -I | awk '{print $1}'):${NGINX_PORT}"
echo ""
echo "如果仍然超时，请检查:"
echo "  1. LLM API endpoint 是否可访问"
echo "  2. 数据库中的模型配置是否正确"
echo "  3. 查看实时日志: docker logs -f ${CONTAINER_NAME}"
echo ""
