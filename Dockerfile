# Railway 从仓库根目录构建时使用此文件，避免 "Error creating build plan with Railpack"
# 实际应用代码在 web/backend
FROM node:20-alpine
WORKDIR /app
COPY web/backend/package*.json ./
RUN npm install --production
COPY web/backend/ .
EXPOSE 3001
CMD ["node", "server.js"]
