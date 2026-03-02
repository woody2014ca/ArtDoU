# Railway 从仓库根目录构建时使用此文件，避免 "Error creating build plan with Railpack"
# 实际应用代码在 web/backend。用 slim 而非 alpine，避免连接 Atlas 时出现 SSL/TLS 握手错误
FROM node:18-slim
WORKDIR /app
# 安装中文字体，供海报 SVG→PNG 渲染（避免乱码方框）
RUN apt-get update && \
    apt-get install -y --no-install-recommends fonts-noto-cjk libfontconfig1 fontconfig && \
    rm -rf /var/lib/apt/lists/* && fc-cache -fv
COPY web/backend/package*.json ./
RUN npm install --production
COPY web/backend/ .
EXPOSE 8080
CMD ["node", "server.js"]
