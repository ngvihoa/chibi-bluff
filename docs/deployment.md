# Deploy

> Lý do chọn phương án này: [decisions/0006-server-on-cloudflare-durable-objects.md](decisions/0006-server-on-cloudflare-durable-objects.md) (server) và [decisions/0001-deploy-web-vercel-server-fly.md](decisions/0001-deploy-web-vercel-server-fly.md) (web).
>
> **Trạng thái:** server là Cloudflare Worker + Durable Objects (checkpoint 15), web nói chuyện với nó qua WebSocket (checkpoint 16), phòng được lưu xuống storage của object (checkpoint 17). Checkpoint 18: hướng dẫn deploy ở mục "Các bước deploy" bên dưới. Kế hoạch: [architecture.md §5.5](architecture.md#55-chuyển-sang-cloudflare-durable-objects-kế-hoạch).

## Tổng quan

```
Trình duyệt ──HTTPS──► Vercel (apps/web, Next.js)
     │
     ├──HTTPS  POST /rooms ─────────► Cloudflare Worker (apps/server)
     └──WebSocket /rooms/<code>/ws ──►   └─► Durable Object "RoomObject" của phòng <code>
```

| Thành phần | Nơi chạy | Ghi chú |
|---|---|---|
| `apps/web` | Vercel | Chơi với bot chạy hoàn toàn trong trình duyệt, không cần server |
| `apps/server` | Cloudflare Workers (gói Free) | Worker chỉ làm router; mỗi phòng là một Durable Object, lưu trạng thái trong SQLite của nó |

## Gói miễn phí của Cloudflare cần để ý

| Giới hạn (gói Workers Free) | Mức | Ý nghĩa với game |
|---|---|---|
| Request mỗi ngày | 100.000 | Tính cả tin WebSocket gửi tới object và alarm. Một ván khoảng vài trăm tin, nên đủ cho hàng trăm ván mỗi ngày |
| Thời gian chạy | 13.000 GB-s / ngày | Object 128 MB tương đương khoảng 29 giờ phòng có người kết nối mỗi ngày |
| Lưu trữ SQLite | 5 GB, 1 GB mỗi object | Một phòng chỉ vài KB |

- Giới hạn tính lại lúc 00:00 UTC (7 giờ sáng giờ Việt Nam). Vượt mức thì request bị từ chối tới khi tính lại; Cloudflare không tự trừ tiền ở gói Free.
- Số liệu lấy theo tài liệu Cloudflare ngày 2026-10-29. Xem lại [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing) và [limits](https://developers.cloudflare.com/durable-objects/platform/limits) trước khi deploy.

## Biến môi trường

| Biến | Ở đâu | Ví dụ |
|---|---|---|
| `NEXT_PUBLIC_GAME_SERVER_URL` | web (Vercel, Production + Preview) | `https://chibi-bluff-server.nvhoa29702.workers.dev` |
| `ALLOWED_ORIGINS` | server (`vars` trong `wrangler.jsonc`) | `https://chibi-bluff.vercel.app,https://chibi-bluff-*-ngvihoas-projects.vercel.app` |
| `STANDIN_MS`, `GAME_SPEED` | server, **chỉ khi test** | E2E: `2000`, `0.1` |

Worker kiểm tra header `Origin` khi mở WebSocket và khi tạo phòng (`src/origins.ts`):
- `ALLOWED_ORIGINS` là danh sách origin chính xác, cách nhau bằng dấu phẩy. `*` khớp với một nhãn tên miền (chữ, số, gạch ngang; không có dấu chấm). Nhờ vậy một mẫu cho phép mọi bản preview của project trên Vercel (`chibi-bluff-git-<nhánh>-ngvihoas-projects.vercel.app`) mà không mở cho team khác.
- Production lấy giá trị trong `wrangler.jsonc`. Khi chạy local, `apps/server/.dev.vars` đặt `ALLOWED_ORIGINS=` (trống), nghĩa là mọi cổng `localhost` / `127.0.0.1` đều được phép. `wrangler dev`, test Worker và e2e đều đọc file này; `wrangler deploy` thì không.

## Server trên Cloudflare

- **Health check:** `GET /healthz` của Worker trả `200`. Không còn đếm số phòng, vì mỗi phòng là một object riêng.
- **Deploy:** `wrangler deploy` (cần `wrangler login` vào tài khoản Cloudflare của bạn). Deploy làm các object khởi động lại và ngắt WebSocket. Client tự nối lại, object đọc trạng thái từ SQLite và ván chơi tiếp.
- **Không còn "tắt máy an toàn" (SIGTERM):** Cloudflare không báo trước khi khởi động lại object; trạng thái đã lưu sẵn sau mỗi thay đổi thay cho bước chờ 60 giây. Tin `server:closing` / lỗi `SERVER_CLOSING` đã bỏ khỏi giao thức.
- **Dọn phòng:** object dùng `alarm` để xoá dữ liệu phòng sau 10 phút không có ai kết nối.
- **Giới hạn tạo phòng:** binding `ROOM_CREATION` trong `wrangler.jsonc` (5 phòng / 60 giây / IP). `namespace_id` là một số tự chọn, chỉ cần không trùng với Worker khác trong cùng tài khoản.
- **Lưu trữ:** mỗi lượt thay đổi ghi một bản chụp phòng (vài KB) vào storage SQLite của object. Gói Free giới hạn số dòng ghi mỗi ngày; một ván khoảng vài trăm lần ghi, nên vẫn dư cho dự án cá nhân.

## Web trên Vercel

- Import repo GitHub, **Root Directory = `apps/web`**. Vercel nhận ra pnpm workspace; lệnh build mặc định `pnpm build` (tự chép asset theme từ `assets/themes`).
- Đặt `NEXT_PUBLIC_GAME_SERVER_URL` cho môi trường Production (và Preview nếu muốn thử online ở bản preview).
- Project **chibi-bluff** đã được nối với repo (2026-10-29). Vercel tự build mỗi lần push và comment link preview vào PR.
- **Khi nào build** ([`apps/web/vercel.json`](../apps/web/vercel.json) → [`scripts/vercel-ignore-build.sh`](../scripts/vercel-ignore-build.sh)):
  - `main`: luôn build (production).
  - Nhánh khác: chỉ build preview khi commit **mới nhất** của lần push có `[deploy]` trong message, ví dụ `feat: sticker picker [deploy]`. Không có thì Vercel bỏ qua, và PR hiện trạng thái "Canceled".
  - Muốn build lại mà không cần commit mới thì bấm Redeploy trên dashboard Vercel.

## Đang chạy ở đâu

| | Địa chỉ |
|---|---|
| Web (production) | https://chibi-bluff.vercel.app |
| Server | https://chibi-bluff-server.nvhoa29702.workers.dev (deploy lần đầu 2026-10-29) |

Subdomain `workers.dev` mới tạo cần khoảng 2 phút để Cloudflare cấp chứng chỉ HTTPS; trong lúc đó trình duyệt báo lỗi TLS.

## Các bước deploy

### Lần đầu

1. **Đăng nhập Cloudflare** (một lần trên mỗi máy; mở trình duyệt để bạn tự đăng nhập):

   ```bash
   pnpm --filter @chibi-bluff/server exec wrangler login
   ```

   Nếu tài khoản chưa có subdomain `workers.dev`, vào dashboard Cloudflare → Workers & Pages để chọn một cái. Subdomain này quyết định địa chỉ `https://chibi-bluff-server.<subdomain>.workers.dev`.
2. **Deploy server:**

   ```bash
   pnpm deploy:server
   ```

   Lần đầu, wrangler tạo Worker `chibi-bluff-server`, chạy migration `v1` (tạo class `RoomObject` lưu bằng SQLite) và in ra địa chỉ Worker.
3. **Kiểm tra:** mở `https://chibi-bluff-server.<subdomain>.workers.dev/healthz`, phải thấy `{"ok":true}`.
4. **Nối web với server:** trên Vercel, project chibi-bluff → Settings → Environment Variables, thêm `NEXT_PUBLIC_GAME_SERVER_URL` = địa chỉ Worker (không có `/` ở cuối) cho **Production** và **Preview**. Biến `NEXT_PUBLIC_*` được gắn vào lúc build, nên phải build lại: Deployments → bản production mới nhất → Redeploy.
5. **Thử thật:** trên điện thoại, mở `https://chibi-bluff.vercel.app`, chọn Chơi với bạn bè, tạo phòng, gửi link mời cho máy thứ hai, thêm bot, chơi một ván. Thử tải lại trang giữa ván và tắt mạng một lúc.

### Những lần sau

- **Web:** tự deploy khi merge vào `main`. Preview của PR chỉ build khi commit có `[deploy]`.
- **Server:** chạy lại `pnpm deploy:server` sau khi merge thay đổi của `apps/server` hoặc các package nó dùng (`engine`, `bots`, `match`, `rooms`, `protocol`, `themes`). Ván đang chơi không mất: object khởi động lại, đọc trạng thái đã lưu, người chơi tự nối lại (checkpoint 17).
- **Đổi giao thức** (`PROTOCOL_VERSION`): deploy server và web gần nhau. Tab cũ sẽ nhận `VERSION_MISMATCH` và được nhắc tải lại trang.
- **Xem log:** `pnpm --filter @chibi-bluff/server exec wrangler tail`, hoặc mục Observability của Worker trên dashboard.
- **Quay lại bản trước:** `pnpm --filter @chibi-bluff/server exec wrangler rollback`.

## Ghi chú chuẩn bị (đã dùng ở checkpoint 18)

1. Tài khoản Cloudflare (gói Free, không cần thẻ), rồi chạy `wrangler login` trên máy. Bạn tự đăng nhập.
2. Chọn tên Worker, ví dụ `chibi-bluff-server`. Tên này quyết định địa chỉ `*.workers.dev`.
3. Tài khoản Vercel nối GitHub, chọn tên project (quyết định địa chỉ `*.vercel.app`).
4. Domain riêng: không bắt buộc, có thể thêm sau.

## Chạy local

```bash
pnpm install
```

Web (`:3000`):

```bash
pnpm dev
```

Server phòng online (`:8080`), ở một terminal khác:

```bash
pnpm dev:server
```

- `pnpm dev:server` chạy `wrangler dev`: Worker và Durable Objects chạy giả lập trên máy (Miniflare), không cần tài khoản Cloudflare. Cổng đặt trong `apps/server/wrangler.jsonc` (`dev.port = 8080`).
- Biến khi chạy local: `pnpm --filter @chibi-bluff/server dev -- --var STANDIN_MS:2000 --var GAME_SPEED:0.1`.
- Sửa `wrangler.jsonc` (thêm binding, biến) thì chạy lại `pnpm --filter @chibi-bluff/server types` để cập nhật `worker-configuration.d.ts`.
- Hai lệnh dev tách riêng vì công cụ xem trước đặt `PORT` cho web; chạy chung thì hai bên tranh cùng cổng.
