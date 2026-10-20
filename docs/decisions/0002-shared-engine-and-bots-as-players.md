# 0002 · Engine dùng chung; bot là một loại người chơi

- **Ngày:** 2026-10-20
- **Trạng thái:** Chấp nhận

## Bối cảnh

Game cần 3 chế độ: chơi với bot (offline), chơi online, và kết hợp (bot lấp chỗ trống, bot thay người rớt mạng).

## Quyết định

- Luật chơi nằm trong `packages/engine`: thuần, deterministic, không I/O. Cả trình duyệt và server cùng dùng.
- Mỗi ghế có một controller (`HumanController` hoặc `BotController`). Engine không phân biệt hai loại này.
- UI làm việc qua interface `GameHost`, có hai bản cài đặt: `LocalHost` (engine chạy trong trình duyệt) và `SocketHost` (engine chạy trên server).
- Bot chỉ nhận `PlayerView`, không bao giờ nhận `GameState`.

## Hệ quả

- Chế độ kết hợp gần như không tốn thêm công: thay controller của ghế là xong.
- Chơi với bot không cần server, nên chạy offline được và không tốn chi phí server.
- Engine phải được thiết kế cẩn thận ngay từ đầu (pending queue, events, view projection), nhưng đổi lại dễ test và replay.
