# 0001 · Web trên Vercel, game server trên Fly.io

- **Ngày:** 2026-10-20
- **Trạng thái:** Chấp nhận

## Bối cảnh

Chơi online cần kết nối realtime, và mỗi phòng cần **một nơi duy nhất giữ trạng thái ván**. Vercel Functions đã hỗ trợ WebSocket, nhưng:
- Hai người trong cùng phòng có thể nối vào hai instance khác nhau, nên phải có Redis để đồng bộ state và pub/sub.
- Kết nối bị cắt khi chạm giới hạn thời gian chạy của function, nên client phải nối lại định kỳ.

## Quyết định

- `apps/web` (Next.js) deploy lên **Vercel**.
- `apps/server` (Node + Socket.IO) deploy lên **Fly.io**: một tiến trình chạy lâu, phòng giữ trong bộ nhớ, region Singapore cho gần Việt Nam.

## Hệ quả

- **Tốt:** mô hình đơn giản nhất cho game theo phòng; không cần Redis ở v1; độ trễ thấp.
- **Chưa tốt:** deploy server làm mất các phòng đang chơi; muốn mở rộng nhiều máy thì phải route theo mã phòng.
- **Phương án thay thế** nếu cần: Cloudflare Durable Objects / PartyKit, mỗi phòng một object. Engine thuần TypeScript nên chuyển được.
