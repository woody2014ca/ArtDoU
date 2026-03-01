# Railway 从仓库根目录构建时使用此文件，避免 "Error creating build plan with Railpack"
# 实际应用代码在 web/backend。用 slim 而非 alpine，避免连接 Atlas 时出现 SSL/TLS 握手错误
FROM node:18-slim
WORKDIR /app
COPY web/backend/package*.json ./
RUN npm install --production
COPY web/backend/ .
EXPOSE 8080
CMD ["node", "server.js"]
