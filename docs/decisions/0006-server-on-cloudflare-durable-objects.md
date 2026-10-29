# 0006 · Game server trên Cloudflare Durable Objects

- **Ngày:** 2026-10-29
- **Trạng thái:** Chấp nhận. Thay phần "server trên Fly.io" của [0001](0001-deploy-web-vercel-server-fly.md); web vẫn ở Vercel.

## Bối cảnh

- Đây là dự án cá nhân, không thương mại. Muốn chạy **miễn phí**.
- Fly.io bỏ gói miễn phí cho tài khoản mới từ 10/2024. Một máy nhỏ chạy liên tục tốn khoảng 2–3 USD/tháng.
- Đã cân nhắc:
  - **Convex Cloud:** miễn phí, nhưng server chỉ ở Mỹ/châu Âu (từ VN khoảng 200 ms trở lên). Phải viết lại `Match` thành hàm lên lịch, và tự làm heartbeat để biết ai rớt mạng.
  - **Tự host Convex:** cần máy từ 1 GB RAM trở lên, tốn tiền và công vận hành hơn cả Fly. Chạy trên Cloudflare cũng không hợp: Workers không chạy được backend Convex, còn Containers ngủ khi rảnh và không giữ ổ đĩa.
  - **Cloudflare Durable Objects (DO):** mỗi phòng là một object có trạng thái riêng, nhận WebSocket, có hẹn giờ và SQLite riêng. Gói Workers Free đã có DO (loại lưu bằng SQLite).

## Quyết định

- `apps/server` chuyển thành một **Cloudflare Worker**. Mỗi phòng là một **Durable Object** (`RoomObject`), lấy theo mã phòng (`idFromName(code)`).
- Chuyển tải bằng **WebSocket thường** (Socket.IO không chạy trên Workers). Giữ nguyên tên và schema tin nhắn trong `packages/protocol`, bọc thêm một lớp phong bì có `id` để trả lời (ack).
- Phòng **không ngủ đông (hibernation)** khi còn người kết nối: `Match` tiếp tục chạy trong bộ nhớ với `setTimeout` như hiện tại. Trạng thái phòng và ván được lưu xuống SQLite của object sau mỗi thay đổi, nên object khởi động lại (deploy, bị dời máy) vẫn khôi phục được.
- Web vẫn deploy lên Vercel.

## Hệ quả

- **Tốt:**
  - Miễn phí ở quy mô dự án cá nhân. Giới hạn gói free: 100.000 request/ngày (tính cả tin WebSocket và alarm), 13.000 GB-s/ngày, tức khoảng 29 giờ phòng hoạt động mỗi ngày với 128 MB.
  - Object được tạo gần người tạo phòng, nên độ trễ thấp.
  - Không phải quản lý máy chủ.
  - Deploy không còn làm mất ván đang chơi, nhờ lưu trạng thái xuống SQLite.
  - Giữ được engine, bot, `Match`, mô hình phòng (`packages/rooms`), schema zod và toàn bộ giao diện.
- **Chưa tốt:**
  - Phải viết lại phần gắn mạng: phía server (`game-server.ts` → `RoomObject` + router của Worker) và phía client (thay `socket.io-client` bằng client WebSocket tự viết, có nối lại và ack).
  - Code gắn với Cloudflare. Phần gắn mạng được giữ mỏng, nên chuyển đi nơi khác vẫn được.
  - Vượt giới hạn free thì request bị từ chối tới hết ngày (giờ UTC). Ở quy mô này khó chạm tới, nhưng cần theo dõi.
- **Phương án dự phòng:**
  - Code Socket.IO + Fly ở checkpoint 12–14 vẫn còn trong lịch sử git.
  - Nếu Cloudflare không ổn thì quay lại Fly (khoảng 2–3 USD/tháng), hoặc dùng Convex Cloud.
