#!/usr/bin/env bash
#
# build.sh — 本地打包 & 一键部署脚本
#
# 用法:
#   ./scripts/build.sh                  # 构建前端 + 打包
#   ./scripts/build.sh --skip-frontend  # 跳过前端构建
#   ./scripts/build.sh --push           # 打包后自动上传并部署到服务器
#   ./scripts/build.sh --skip-frontend --push
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# 读取配置
CONF_FILE="$SCRIPT_DIR/deploy.conf"
if [ ! -f "$CONF_FILE" ]; then
    echo "错误: 未找到 $CONF_FILE"
    exit 1
fi
source "$CONF_FILE"

VERSION=$(date +%Y%m%d-%H%M%S)
PACKAGE_NAME="llm-finetune-${VERSION}"

# 参数解析
SKIP_FRONTEND=false
PUSH=false
for arg in "$@"; do
    case "$arg" in
        --skip-frontend) SKIP_FRONTEND=true ;;
        --push) PUSH=true ;;
        *) echo "未知参数: $arg"; exit 1 ;;
    esac
done

echo "=============================="
echo "  LLM Fine-tune Platform - 打包"
echo "  版本: $VERSION"
echo "=============================="

# Step 1: 构建前端
if [ "$SKIP_FRONTEND" = false ]; then
    echo ""
    echo "[1/2] 构建前端..."
    cd "$PROJECT_ROOT/frontend"
    [ ! -d "node_modules" ] && npm install --no-audit --no-fund
    npm run build
else
    echo ""
    echo "[1/2] 跳过前端构建"
    if [ ! -d "$PROJECT_ROOT/frontend/dist" ]; then
        echo "  错误: frontend/dist/ 不存在，请先执行一次完整构建"
        exit 1
    fi
fi

# Step 2: 打包（仅包含部署所需文件，去掉 macOS 扩展属性）
echo ""
echo "[2/2] 打包..."
mkdir -p "$PROJECT_ROOT/release"
cd "$PROJECT_ROOT"

# macOS bsdtar: 去掉扩展属性，避免服务器解压时大量 xattr 警告
TAR_OPTS=()
if [[ "$OSTYPE" == darwin* ]]; then
    TAR_OPTS+=(--no-mac-metadata --no-xattrs)
fi

COPYFILE_DISABLE=1 tar -czf "release/${PACKAGE_NAME}.tar.gz" \
    ${TAR_OPTS[@]+"${TAR_OPTS[@]}"} \
    --exclude='.git' \
    --exclude='release' \
    --exclude='data' \
    --exclude='backend/.venv' \
    --exclude='backend/data' \
    --exclude='backend/logs' \
    --exclude='__pycache__' \
    --exclude='.DS_Store' \
    --exclude='*.pyc' \
    --exclude='node_modules' \
    --exclude='.vite' \
    --exclude='.pytest_cache' \
    .

PACKAGE_SIZE=$(ls -lh "release/${PACKAGE_NAME}.tar.gz" | awk '{print $5}')

echo ""
echo "=============================="
echo "  打包完成!"
echo "  文件: release/${PACKAGE_NAME}.tar.gz"
echo "  大小: $PACKAGE_SIZE"
echo "=============================="

# Step 3: 一键上传 & 部署
if [ "$PUSH" = true ]; then
    echo ""
    echo "[push] 上传到 ${REMOTE_HOST}..."

    PACKAGE_FILE="release/${PACKAGE_NAME}.tar.gz"

    # SSH 辅助函数（兼容有无 sshpass 的环境）
    remote_ssh() {
        if command -v sshpass &>/dev/null; then
            sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${REMOTE_USER}@${REMOTE_HOST}" "$@"
        else
            ssh -o StrictHostKeyChecking=no "${REMOTE_USER}@${REMOTE_HOST}" "$@"
        fi
    }

    # 上传（用 ssh+cat 管道，比 scp 兼容性更好）
    cat "$PACKAGE_FILE" | remote_ssh "cat > /tmp/${PACKAGE_NAME}.tar.gz"
    echo "  上传完成 ($PACKAGE_SIZE)"

    echo ""
    echo "[push] 远程部署..."
    remote_ssh "cd /tmp && rm -rf ${PACKAGE_NAME} && mkdir -p ${PACKAGE_NAME} && tar -xzf /tmp/${PACKAGE_NAME}.tar.gz -C ${PACKAGE_NAME} && cd ${PACKAGE_NAME} && bash scripts/deploy.sh"

    echo ""
    echo "=============================="
    echo "  部署完成!"
    echo "  访问: http://${REMOTE_HOST}:${NGINX_PORT}"
    echo "=============================="
else
    echo ""
    echo "部署命令:"
    echo "  ./scripts/build.sh --push          # 一键上传部署"
    echo "  ./scripts/build.sh --push --skip-frontend  # 跳过前端，一键部署"
fi
