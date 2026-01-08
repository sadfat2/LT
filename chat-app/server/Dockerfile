FROM node:18-alpine

WORKDIR /app

# 安装 nodemon 用于开发热重载
RUN npm install -g nodemon

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制源代码
COPY . .

# 创建上传目录
RUN mkdir -p uploads/avatars uploads/images uploads/voices

EXPOSE 3000

# 开发模式使用 nodemon
CMD ["nodemon", "src/app.js"]
