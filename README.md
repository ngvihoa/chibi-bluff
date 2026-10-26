# Chibi Bluff: Giang Hồ Nhí Nhố

**Tiếng Việt** · [English](#english)

Game lừa bịp chibi trên web: tuyên bố mình là ai cũng được, miễn đừng để bị **lộ tẩy**. Chơi với bot, chơi online với bạn bè, hoặc kết hợp cả hai. Ưu tiên điện thoại, song ngữ Việt / Anh.

> 🚧 Đang trong giai đoạn thiết kế. Chưa chơi được.

### Chạy ở máy

Cần Node ≥ 22 và pnpm 10.

```bash
pnpm install
pnpm dev          # web app tại http://localhost:3000
pnpm dev:server   # server phòng online tại http://localhost:8080
pnpm check        # lint + typecheck + test
pnpm bots:sim     # bot đấu bot, in tỉ lệ thắng
pnpm e2e          # test e2e bằng Playwright (cần Google Chrome)
```

- Luật chơi: [docs/game-rules.md](docs/game-rules.md)
- Tài liệu kỹ thuật & thiết kế: [docs/](docs/README.md)
- Concept hình ảnh: [design/concepts/](design/concepts/README.md)

---

## English

A chibi bluffing game for the web: claim to be anyone, just don't get **busted**. Play against bots, online with friends, or both at once. Mobile-first, Vietnamese and English.

> 🚧 In design. Not playable yet.

Project documentation is written in Vietnamese; see [docs/](docs/README.md).

---

*Chibi Bluff uses the game mechanics of the board game* Coup *by Rikki Tahta. It is an independent fan project and is not affiliated with or endorsed by the original designer or publishers. All names and artwork in this repository are original.*
