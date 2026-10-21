# Tài liệu dự án Chibi Bluff

**Chibi Bluff** là game lừa bịp (bluff) trên web, dựa trên cơ chế của board game *Coup*: chơi với bot, chơi online, hoặc kết hợp cả hai. Ưu tiên mobile, song ngữ Việt / Anh, nhiều bộ chủ đề hình ảnh. Bộ chủ đề đầu tiên: **Giang Hồ Nhí Nhố**.

| Tài liệu | Nội dung |
|---|---|
| [game-rules.md](game-rules.md) | Luật chơi chuẩn cho engine; mỗi quy tắc có mã (`R-CH-4`…) |
| [architecture.md](architecture.md) | Kiến trúc: monorepo, engine, host, online, web, kiểm thử, lộ trình |
| [bot-ai.md](bot-ai.md) | Bot ra quyết định thế nào: niềm tin, EV, độ khó, tính cách |
| [ui-design.md](ui-design.md) | Design tokens, lá bài, bàn chơi, chuyển động, sticker, hệ thống theme |
| [deployment.md](deployment.md) | Deploy web (Vercel) và server (Fly.io) |
| [decisions/](decisions/) | Các quyết định lớn và lý do (ADR) |

**Liên quan:**
- Asset theme: [assets/themes/](../assets/themes/)
- Concept hình ảnh: [design/concepts/](../design/concepts/)

## Quy ước

- Viết tài liệu bằng tiếng Việt. Thuật ngữ trong code (role, action, phase) giữ tiếng Anh.
- Quyết định lớn mới → thêm file `decisions/NNNN-ten-ngan.md` (Bối cảnh · Quyết định · Hệ quả).
- Thay đổi luật → cập nhật `game-rules.md` trước, rồi tới test, rồi tới code.
