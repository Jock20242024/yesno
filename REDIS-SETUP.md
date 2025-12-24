# Redis 服务设置说明

## 当前状态

✅ **Redis 服务已启动并运行**

- **容器名称**: `yesno-redis`
- **端口**: `6379` (默认端口)
- **镜像**: `redis:7-alpine`
- **状态**: 运行中

## 验证连接

Redis 服务已通过测试，返回 `PONG` 响应。

## 使用方法

### 启动 Redis（如果已停止）

```bash
docker start yesno-redis
```

### 停止 Redis

```bash
docker stop yesno-redis
```

### 重启 Redis

```bash
docker restart yesno-redis
```

### 查看 Redis 状态

```bash
docker ps --filter "name=yesno-redis"
```

### 连接 Redis CLI

```bash
docker exec -it yesno-redis redis-cli
```

### 测试连接

```bash
docker exec yesno-redis redis-cli ping
# 应该返回: PONG
```

## 应用配置

应用会自动连接到 `localhost:6379`（Redis 默认端口）。

如果需要修改连接配置，请在 `.env.local` 文件中添加：

```env
REDIS_URL=redis://localhost:6379
```

或者分别指定：

```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

## 数据持久化

当前 Redis 容器使用默认配置，数据存储在容器内部。如果容器被删除，数据会丢失。

如果需要数据持久化，可以使用以下命令重新创建容器：

```bash
docker stop yesno-redis
docker rm yesno-redis
docker run --name yesno-redis -d -p 6379:6379 \
  -v redis-data:/data \
  redis:7-alpine redis-server --appendonly yes
```

## 故障排除

### 如果端口 6379 已被占用

修改端口映射：

```bash
docker run --name yesno-redis -d -p 6380:6379 redis:7-alpine
```

然后更新 `.env.local`：

```env
REDIS_PORT=6380
```

### 查看 Redis 日志

```bash
docker logs yesno-redis
```

### 删除并重新创建容器

```bash
docker stop yesno-redis
docker rm yesno-redis
docker run --name yesno-redis -d -p 6379:6379 redis:7-alpine
```

## 下一步

现在 Redis 服务已就绪，你可以：

1. 启动应用：`npm run dev`
2. 测试赔率机器人功能
3. 查看监控面板中的队列状态
