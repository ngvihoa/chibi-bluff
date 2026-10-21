# Deploy

> Lý do chọn phương án này: [decisions/0001-deploy-web-vercel-server-fly.md](decisions/0001-deploy-web-vercel-server-fly.md)

## Tổng quan

```
Trình duyệt ──HTTPS──► Vercel (apps/web, Next.js)
     │
     └──WebSocket──► Fly.io (apps/server, Node + Socket.IO), region sin (Singapore)
```

| Thành phần | Nơi chạy | Ghi chú |
|---|---|---|
| `apps/web` | Vercel | Chế độ chơi với bot chạy hoàn toàn trong trình duyệt, không cần server |
| `apps/server` | Fly.io, 1 máy | Phòng giữ trong bộ nhớ của một tiến trình duy nhất |

## Biến môi trường

| Biến | Ở đâu | Ví dụ |
|---|---|---|
| `NEXT_PUBLIC_GAME_SERVER_URL` | web | `https://chibi-bluff-server.fly.dev` |
| `ALLOWED_ORIGINS` | server | `https://chibi-bluff.vercel.app,http://localhost:3000` |
| `PORT` | server | `8080` |

## Server

- **Health check:** `GET /healthz` trả về `200` cùng số phòng đang mở.
- **Tắt máy an toàn:** khi nhận `SIGTERM`, ngừng tạo phòng mới, báo cho client "server bảo trì", chờ tối đa 60 giây cho các ván đang dở.
- **Deploy mới làm mất các phòng đang chơi** vì phòng nằm trong bộ nhớ. Chấp nhận ở v1; nên deploy vào giờ vắng.
- Cấu hình Fly: `min_machines_running = 1`, tắt auto-stop. Socket bị ngắt khi máy ngủ.

## Mở rộng sau này

Khi một máy không còn đủ tải:
1. **Nhiều máy:** route theo mã phòng, để mọi người trong cùng phòng vào cùng một máy (dùng `fly-replay` header). Lưu bảng phòng ↔ máy trong Redis.
2. **Hoặc** chuyển sang Cloudflare Durable Objects / PartyKit: mỗi phòng là một object. Engine thuần nên chuyển dễ dàng.

## Chạy local

```bash
pnpm install
```

```bash
pnpm dev
```

Lệnh `pnpm dev` chạy cả web (`:3000`) và server (`:8080`). Script cụ thể sẽ có khi dựng project.
