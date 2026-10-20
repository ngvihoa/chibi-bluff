# Kiến trúc kỹ thuật

> Trạng thái: **đề xuất**, chưa có code. Cập nhật tài liệu này khi triển khai thay đổi thiết kế.

## 1. Mục tiêu

| Mục tiêu | Hệ quả thiết kế |
|---|---|
| Chơi **với bot**, **online**, hoặc **kết hợp** | Bot là một loại người chơi; game không phân biệt người hay bot |
| Không thể gian lận khi chơi online | Server giữ toàn bộ trạng thái và tự xử lý mọi thay đổi; client chỉ nhận phần được phép thấy |
| Luật chơi đúng tuyệt đối | Engine là code thuần, deterministic, test theo mã luật trong [game-rules.md](game-rules.md) |
| Song ngữ Việt / Anh | Mọi chữ hiển thị đi qua i18n; engine không chứa chữ hiển thị |
| Nhiều bộ chủ đề | Engine chỉ biết `role` (duke, assassin…); tên/hình lấy từ theme manifest |

## 2. Cấu trúc repo (monorepo, pnpm workspaces)

```
coup/
├── apps/
│   ├── web/            Next.js (App Router): giao diện, chế độ chơi local với bot
│   └── server/         Node + Socket.IO: phòng chơi online
├── packages/
│   ├── engine/         Luật chơi: state machine thuần TypeScript, không phụ thuộc gì
│   ├── bots/           Logic bot: nhận PlayerView, trả về quyết định
│   ├── protocol/       Kiểu dữ liệu & schema (zod) cho tin nhắn client ↔ server
│   └── themes/         Đọc theme manifest, kiểu dữ liệu Theme
├── assets/themes/      Asset gốc của từng chủ đề (SVG + theme.json)
├── design/concepts/    Trang preview concept (nguồn vẽ asset)
├── scripts/            Script tiện ích (VD: xuất asset)
└── docs/
```

**Hướng phụ thuộc** (không được ngược chiều):

```
web ──► engine, bots, protocol, themes
server ──► engine, bots, protocol
bots ──► engine
protocol ──► engine (chỉ dùng kiểu dữ liệu)
engine ──► (không gì cả)
```

**Công cụ:** TypeScript strict · pnpm workspaces · Vitest · Biome (lint + format) · zod.

## 3. Game engine (`packages/engine`)

### 3.1 Nguyên tắc

- **Thuần (pure):** `(state, input) → { state, events }`. Không đọc đồng hồ, không gọi random toàn cục, không I/O.
- **Deterministic:** xáo bài dùng PRNG có seed, lưu trong state. Cùng seed + cùng chuỗi input → cùng kết quả. Nhờ đó có thể replay ván, tái hiện bug và viết test chính xác.
- **Thời gian là input:** engine không tự đếm giờ. Engine lưu `deadline`; bên chạy engine (server hoặc client local) gửi input `TIMEOUT` khi hết giờ.
- **Không chứa chữ hiển thị:** chỉ có mã (`role: "duke"`, `error: "NOT_ENOUGH_COINS"`).

### 3.2 API công khai

```ts
createGame(config: GameConfig, seed: string): GameState
applyInput(state: GameState, input: Input): ApplyResult      // { ok: true, state, events } | { ok: false, error }
getLegalInputs(state: GameState, playerId: PlayerId): Input[]
getPlayerView(state: GameState, playerId: PlayerId | null): PlayerView   // null = khán giả
```

`Input` là hợp của:
- `{ type: "DECLARE", playerId, action, targetId? }`
- `{ type: "CHALLENGE", playerId }`
- `{ type: "BLOCK", playerId, role }`
- `{ type: "PASS", playerId }`
- `{ type: "CHOOSE_LOSS", playerId, cardIndex }`
- `{ type: "CHOOSE_EXCHANGE", playerId, keep: number[] }`
- `{ type: "TIMEOUT" }`: chỉ do host gửi

### 3.3 State machine

Bám theo mục 9 của [game-rules.md](game-rules.md):

```
AWAIT_ACTION ──DECLARE──► AWAIT_ACTION_RESPONSE ──(tất cả PASS)──► thực thi
      ▲                        │CHALLENGE        │BLOCK
      │                        ▼                 ▼
      │                  (giải quyết)      AWAIT_BLOCK_RESPONSE ──CHALLENGE──► (giải quyết)
      │                        │                 │(tất cả PASS) → hành động thất bại
      │                        ▼
      │        AWAIT_INFLUENCE_LOSS / AWAIT_EXCHANGE  (chen vào khi cần)
      └──────────── END_TURN ◄───────────┘                  GAME_OVER
```

- Các bước "chen ngang" (chọn lá bỏ, chọn lá giữ) dùng **hàng đợi `pending`**: mỗi phần tử mô tả việc cần làm tiếp theo. Nhờ vậy các chuỗi phức tạp như `R-IN-4` (mất 2 lá trong một lượt) xử lý tự nhiên.
- Phase `AWAIT_ACTION_RESPONSE` lưu tập `passed` để kết thúc sớm theo `R-DG-2`.

### 3.4 Events

Mỗi lần `applyInput` trả về danh sách event, VD: `ACTION_DECLARED`, `CHALLENGE_RESOLVED { liar, revealedRole }`, `CARD_LOST`, `COINS_MOVED`, `PLAYER_ELIMINATED`, `GAME_OVER`.
- UI dùng event để **chạy animation** và **ghi log**, không phải tự so sánh hai state.
- Event cũng được lọc theo người xem, giống `PlayerView`. VD: ai rút lá gì khi Exchange thì chỉ người đó thấy.

### 3.5 Ẩn thông tin (`R-DG-6`)

`getPlayerView` là **chốt chặn duy nhất** giữa state đầy đủ và bên ngoài:
- Thấy được: lá úp của chính mình, mọi lá đã lật, coin của mọi người, số lá úp của người khác, số lá trong bộ bài, lịch sử public, phase và deadline hiện tại.
- Không bao giờ thấy: lá úp của người khác, thứ tự bộ bài, seed PRNG.

Có test bắt buộc: serialize `PlayerView` của mỗi người rồi kiểm tra không chứa lá úp của người khác.

## 4. Người chơi & Host

### 4.1 Controller

Mỗi ghế có một **controller**:
- `HumanController`: chờ input từ UI (local) hoặc từ socket (online).
- `BotController`: khi tới lượt mình được phản ứng, gọi `bots.decide(view, legalInputs)`, chờ "thời gian suy nghĩ" giả lập rồi gửi input.

Engine không biết controller nào là người, nào là bot.

### 4.2 GameHost

Interface chung cho hai chế độ:

```ts
interface GameHost {
  submit(input: Input): void                 // gửi ý định của người chơi
  subscribe(cb: (view: PlayerView, events: GameEvent[]) => void): Unsubscribe
}
```

| | `LocalHost` (trong trình duyệt) | `SocketHost` (online) |
|---|---|---|
| Chạy engine ở đâu | Trong trình duyệt (Web Worker cho bot Khó) | Trên server |
| Bot chạy ở đâu | Trình duyệt | Server |
| Hẹn giờ `TIMEOUT` | `setTimeout` phía client | Server |
| Cần mạng | Không | Có |

UI chỉ làm việc với `GameHost`, nên mọi màn hình chơi dùng chung cho cả hai chế độ.

## 5. Online (`apps/server`)

### 5.1 Phòng chơi

- Mỗi phòng có **mã 5 ký tự** (bỏ các ký tự dễ nhầm như 0/O, 1/I), giữ trong bộ nhớ: `Map<roomCode, Room>`.
- `Room` gồm: danh sách ghế (người hoặc bot), cài đặt (số giây phản ứng, theme, độ khó bot), `GameState`, các timer.
- Chủ phòng có thể: thêm/xóa bot, đổi cài đặt, bắt đầu ván, kick người chơi.
- v1 **không có tài khoản**: người chơi nhập nickname; server cấp `sessionToken` lưu trong `localStorage` để nối lại.

### 5.2 Luồng tin nhắn

```
Client                         Server
  │── room:join {code, name} ──►│
  │◄─ room:state ──────────────│  danh sách ghế, cài đặt
  │── game:input {Input} ──────►│  validate (zod) → engine.applyInput
  │◄─ game:update {view, events}│  gửi RIÊNG cho từng người: getPlayerView(state, id)
  │── chat:sticker {id} ───────►│  rate limit
```

- Mọi tin nhắn có schema trong `packages/protocol` và kèm `protocolVersion`.
- Server **không bao giờ broadcast state đầy đủ**. Mỗi socket chỉ nhận view của ghế mình.
- Input không hợp lệ: trả lỗi cho riêng người gửi, state giữ nguyên.

### 5.3 Rớt mạng & bot thay thế

1. Socket ngắt → ghế chuyển sang `disconnected`, ván vẫn chạy; tới lượt người đó thì timer xử lý như bình thường.
2. Sau **30 giây** chưa nối lại → `BotController` (độ khó Thường) **tạm điều khiển ghế**.
3. Người chơi nối lại bằng `sessionToken` → giành lại quyền điều khiển ngay.

### 5.4 Chống lạm dụng

- Rate limit theo socket (input, sticker, tạo phòng).
- Giới hạn số phòng đang mở và dọn phòng trống sau 10 phút.
- Nickname: giới hạn độ dài, lọc ký tự điều khiển.

## 6. Web app (`apps/web`)

- **Next.js App Router**, chủ yếu client component cho màn chơi.
- **State UI:** Zustand. Store giữ `PlayerView` mới nhất cùng hàng đợi event để animation chạy lần lượt.
- **Animation:** Motion (Framer Motion). **Âm thanh:** Howler (giai đoạn sau).
- **i18n:** `next-intl`, file `messages/vi.json` và `messages/en.json`. Ngôn ngữ nhớ trong cookie. Tên nhân vật và tiền tệ lấy từ theme manifest theo ngôn ngữ hiện tại.
- **Route dự kiến:**

| Route | Nội dung |
|---|---|
| `/` | Trang chủ: Chơi với bot · Tạo phòng · Vào phòng |
| `/play/local` | Thiết lập ván với bot rồi chơi luôn |
| `/room/[code]` | Phòng chờ và bàn chơi online |
| `/rules` | Luật chơi minh họa |

## 7. Theme

- Engine chỉ biết 5 `role`. Theme quyết định tên, màu, hình, sticker, tiền tệ.
- Asset gốc ở `assets/themes/<id>/`. Lúc build, web app copy vào `public/themes/<id>/`.
- Định dạng manifest: [assets/themes/giang-ho/theme.json](../assets/themes/giang-ho/theme.json). Chi tiết thiết kế ở [ui-design.md](ui-design.md).
- Theme hiện tại của bàn là cài đặt của phòng. Mọi người trong phòng thấy cùng một theme.

## 8. Kiểm thử

| Tầng | Cách test |
|---|---|
| Engine | Unit test theo mã luật (`R-CH-4`…), mỗi test ghi rõ mã luật trong tên |
| Engine | Property-based test (fast-check): chạy hàng nghìn ván ngẫu nhiên, kiểm tra các bất biến: luôn đủ 15 lá, coin không âm, ván luôn kết thúc, không lộ thông tin trong view |
| Bots | Giả lập bot đấu bot hàng loạt; kiểm tra Khó thắng Thường, Thường thắng Dễ với tỉ lệ rõ rệt |
| Protocol | Test schema; test server với client giả (socket.io-client) |
| Web | Playwright: tạo phòng, 2 tab cùng vào, chơi hết một ván với bot |

## 9. Lộ trình triển khai

1. **Engine và test:** đủ luật, đạt toàn bộ test theo mã luật.
2. **Chơi local với bot:** `LocalHost`, giao diện bàn chơi, bot Dễ và Thường.
3. **Online:** server, phòng, `SocketHost`, nối lại khi rớt mạng.
4. **Kết hợp:** thêm bot vào phòng online, bot tạm thay người rớt mạng, sticker.
5. **Nâng cao:** bot Khó, âm thanh, thêm theme mới.

Deploy: xem [deployment.md](deployment.md).
