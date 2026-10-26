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
| Ưu tiên mobile | Giao diện thiết kế cho điện thoại dọc trước; payload nhỏ, bot Thường chạy nhẹ trên máy yếu |
| Repo public | Không commit secret; mọi cấu hình nhạy cảm qua biến môi trường |

### 1.1 Phạm vi MVP

| Có trong MVP | Để sau |
|---|---|
| Chơi với bot (Dễ, Thường), offline | Bot Khó |
| Phòng online bằng mã, 2–6 người | Khán giả xem trận |
| Bot lấp chỗ trống, bot thay người rớt mạng | Chat chữ |
| Sticker | Âm thanh, nhạc nền |
| Song ngữ Việt / Anh | Chơi lại nhanh (rematch), thống kê, tài khoản |
| Theme Giang Hồ Nhí Nhố | Theme thứ hai trở đi, PWA cài lên màn hình chính |

## 2. Cấu trúc repo (monorepo, pnpm workspaces)

```
chibi-bluff/
├── apps/
│   ├── web/            Next.js (App Router): giao diện, chế độ chơi local với bot
│   └── server/         Node + Socket.IO: phòng chơi online
├── packages/
│   ├── engine/         Luật chơi: state machine thuần TypeScript, không phụ thuộc gì
│   ├── bots/           Logic bot: nhận PlayerView, trả về quyết định
│   ├── match/          Chạy một ván: engine + bot + hẹn giờ + nhịp chơi (client và server dùng chung)
│   ├── protocol/       Kiểu dữ liệu & schema (zod) cho tin nhắn client ↔ server
│   ├── rooms/          Mô hình phòng thuần: phòng chờ, ghế, cài đặt, bắt đầu, kick
│   └── themes/         Đọc và kiểm tra theme manifest, kiểu dữ liệu Theme, URL asset
├── assets/themes/      Asset gốc của từng chủ đề (SVG + theme.json)
├── design/concepts/    Trang preview concept (nguồn vẽ asset)
├── scripts/            Script tiện ích (VD: xuất asset)
└── docs/
```

**Hướng phụ thuộc** (không được ngược chiều):

```
web ──► engine, bots, match, protocol, themes
server ──► engine, match, protocol, rooms, themes, socket.io
rooms ──► engine, match, protocol
match ──► engine, bots
bots ──► engine
themes ──► engine (chỉ dùng kiểu Role và danh sách ROLES)
protocol ──► engine (kiểu dữ liệu và danh sách ROLES/ACTION_TYPES), zod
engine ──► (không gì cả)
```

Package dùng scope `@chibi-bluff/*` (VD: `@chibi-bluff/engine`).

**Công cụ:** TypeScript strict · pnpm workspaces · Vitest · Biome (lint + format) · zod.

## 3. Game engine (`packages/engine`)

### 3.1 Nguyên tắc

- **Thuần (pure):** `(state, input) → { state, events }`. Không đọc đồng hồ, không gọi random toàn cục, không I/O.
- **Deterministic:** xáo bài dùng PRNG có seed, lưu trong state. Cùng seed + cùng chuỗi input → cùng kết quả. Nhờ đó có thể replay ván, tái hiện bug và viết test chính xác.
- **Thời gian là input:** engine không tự đếm giờ. Host truyền `now` vào mỗi lần gọi; engine tính và lưu `deadline`; host gửi input `TIMEOUT` khi hết giờ.
- **Không chứa chữ hiển thị:** chỉ có mã (`role: "duke"`, `error: "NOT_ENOUGH_COINS"`).

### 3.2 API công khai

```ts
createGame(config: GameConfig, seed: string, now: number): { state, events }
applyInput(state: GameState, input: Input, now: number): ApplyResult   // { ok: true, state, events } | { ok: false, error }
getLegalInputs(state: GameState, playerId: PlayerId): PlayerInput[]
getPlayerView(state: GameState, viewerId: PlayerId | null): PlayerView // null = khán giả
getEventsForViewer(events: GameEvent[], viewerId: PlayerId | null): GameEvent[]
```

`Input` là hợp của:
- `{ type: "DECLARE", playerId, action, targetId? }`
- `{ type: "CHALLENGE", playerId }`
- `{ type: "BLOCK", playerId, role }`
- `{ type: "PASS", playerId }`
- `{ type: "CHOOSE_LOSS", playerId, cardIndex }`
- `{ type: "CHOOSE_EXCHANGE", playerId, keep: number[] }`: chỉ số trong `options` của phase
- `{ type: "TIMEOUT" }`: chỉ do host gửi

Mọi input của người chơi có thể kèm `phaseId` (lấy từ `PlayerView`). Nếu `phaseId` khác phase hiện tại, engine trả `STALE_INPUT`. Việc này chặn trường hợp một cú "Thách!" gửi chậm qua mạng lại rơi vào hành động của lượt sau. `phaseId` chỉ tăng khi sang phase mới, không tăng khi có người bỏ qua trong cùng một cửa sổ, nên các phản hồi gửi đồng thời vẫn hợp lệ. Client nên luôn gửi kèm `phaseId`.

### 3.3 State machine

Bám theo mục 9 của [game-rules.md](game-rules.md):

```
AWAIT_ACTION ──DECLARE──► AWAIT_ACTION_RESPONSE ──(tất cả PASS)──► thực thi
      ▲                        │CHALLENGE        │BLOCK
      │                        ▼                 ▼
      │                  (giải quyết)      AWAIT_BLOCK_RESPONSE ──CHALLENGE──► (giải quyết)
      │                        │                 │(tất cả PASS) → hành động thất bại
      │                        ▼
      │        AWAIT_INFLUENCE_LOSS / AWAIT_EXCHANGE / AWAIT_REPLACEMENT  (chen vào khi cần)
      └──────────── END_TURN ◄───────────┘                  GAME_OVER
```

- Các bước "chen ngang" (chọn lá bỏ, chọn lá giữ, bốc lá thay thế) dùng **hàng đợi `pending`**: mỗi phần tử mô tả việc cần làm tiếp theo. Nhờ vậy các chuỗi phức tạp như `R-IN-4` (mất 2 lá trong một lượt) xử lý tự nhiên.
- Trong cửa sổ phản ứng, `pending` chứa sẵn **diễn biến nếu không ai phản đối** (`EXECUTE_ACTION`, `END_TURN`). Challenge hoặc block chỉ việc viết lại hàng đợi này.
- Phase `AWAIT_ACTION_RESPONSE` lưu tập `passed` để kết thúc sớm theo `R-DG-2`. Cờ `allowChallenge: false` dùng cho cửa sổ chỉ-được-chặn, mở lại sau khi challenge hành động thất bại.
- Mã nguồn: `game.ts` (state machine), `legal.ts` (input hợp lệ), `view.ts` (ẩn thông tin), `state.ts` (hàm đọc dùng chung).

### 3.4 Events

Mỗi lần `applyInput` trả về danh sách event, VD: `ACTION_DECLARED`, `CHALLENGE_RESOLVED { truthful, role }`, `INFLUENCE_LOST { reason }`, `COINS_CHANGED { delta, reason }`, `PLAYER_ELIMINATED`, `GAME_OVER`. Danh sách đầy đủ: kiểu `GameEvent` trong `packages/engine/src/types.ts`.
- UI dùng event để **chạy animation** và **ghi log**, không phải tự so sánh hai state.
- Event cũng được lọc theo người xem qua `getEventsForViewer`, giống `PlayerView`: lá rút khi Exchange (`EXCHANGE_STARTED.drawn`) và lá mới sau khi thắng challenge (`CARD_REPLACED.newRole`) chỉ chủ nhân thấy.

### 3.5 Ẩn thông tin (`R-DG-6`)

`getPlayerView` là **chốt chặn duy nhất** giữa state đầy đủ và bên ngoài:
- Thấy được: lá úp của chính mình, mọi lá đã lật, coin của mọi người, số lá úp của người khác, số lá trong bộ bài, lịch sử public, phase và deadline hiện tại.
- Không bao giờ thấy: lá úp của người khác, thứ tự bộ bài, seed PRNG.

Có test bắt buộc: trong hàng trăm ván ngẫu nhiên, sau mỗi bước, kiểm tra `PlayerView` và event đã lọc của mỗi người không chứa lá úp của người khác.

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
  getSnapshot(): HostSnapshot                 // { seats, view, legal, log, latest }
  subscribe(listener: () => void): () => void
  submit(input: PlayerInput): EngineError | null
  dispose(): void
}
```

- `HostSnapshot` chứa thông tin ghế (tên, người/bot, avatar), `PlayerView` của người chơi, **danh sách input hợp lệ** của họ, log event đã lọc, và các event của lần cập nhật gần nhất (dùng cho animation). Client không giữ `GameState`, nên host phải gửi kèm `legal`.
- Mỗi lần thay đổi, host tạo snapshot mới (object bất biến). Nhờ vậy React đọc thẳng bằng `useSyncExternalStore` (hook `useGameHost`), không cần thư viện quản lý state.
- **`Match`** (`packages/match`) chạy một ván: engine, bot, hẹn giờ và nhịp chơi. `LocalHost` trong trình duyệt và server online đều bọc cùng một `Match`, nên chơi online cùng nhịp với chơi bot.
  - Mỗi bot quyết định ngay khi có lượt, nhưng chỉ gửi input sau `thinkMs`, kèm `phaseId` lúc ra quyết định. Nếu phase đã đổi thì engine từ chối (`STALE_INPUT`), và bot được lên lịch lại theo phase mới.
  - Bot đã có nước đi chờ sẵn cho phase hiện tại thì giữ nguyên khi người khác bỏ qua trong cùng cửa sổ phản ứng.
  - Khi có khoảnh khắc (challenge, bị loại, hết lượt, chặn, người bốc lá thay thế), bot đợi hết `MOMENT_MS` × `speed`; phase mở ra trong lúc đó được lùi deadline tương ứng.
  - Hết `deadline` thì `Match` gửi `TIMEOUT`.
  - Ghế không có bot nhận input từ bên ngoài (`submit`). `setBot(id, bot | null)` cho bot tạm điều khiển một ghế rồi trả lại (§5.3). Mọi ghế đều có bộ nhớ bot từ đầu ván, nên bot vào giữa ván vẫn nhớ những gì đã diễn ra.
  - Đồng hồ (`Clock`) có thể thay để test. `dispose()` huỷ mọi bộ hẹn giờ.
- **`LocalHost`** (`apps/web/src/game/local-host.ts`) chỉ còn lọc event cho người chơi, giữ log và dựng snapshot.

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
- `Room` gồm: danh sách ghế (người hoặc bot), cài đặt (số giây phản ứng, theme, độ khó bot, giới hạn thời gian chọn hành động: tắt hoặc bật tối đa 120 giây theo `R-DG-7`; schema trong `packages/protocol` chặn giá trị lớn hơn), `GameState`, các timer.
- Chủ phòng có thể: thêm/xóa bot, đổi cài đặt, bắt đầu ván, kick người chơi.
- **Cài đặt phòng** (chốt 2026-10-25), chỉnh trong phòng chờ:

  | Cài đặt | Lựa chọn |
  |---|---|
  | Nhịp chơi (thời gian phản ứng và chọn lá) | Thong thả / Vừa / Nhanh, giống chơi với bot |
  | Giới hạn thời gian chọn hành động (`R-DG-7`) | Tắt / 30 giây / 60 giây / 2 phút |
  | Độ khó bot thêm vào phòng | Dễ / Thường |
  | Bot | Thêm hoặc xóa từng bot vào ghế trống |
  | Người chơi | Kick |
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

- Mọi tin nhắn có schema trong `packages/protocol`. Tin vào phòng (`room:create`, `room:join`) kèm `protocolVersion`; client cũ nhận `VERSION_MISMATCH` để tải lại trang.
- Tin client → server được parse bằng zod (`parseClientMessage`) trước khi tới phòng hay engine. Mọi tin đều có ack `{ ok: true, … }` hoặc `{ ok: false, error }`. Tin server → client (`room:state`, `game:sync`, `game:update`, `room:kicked`, `chat:sticker`) chỉ có kiểu TypeScript, vì server đã lọc sẵn cho từng ghế.
- `game:input` không tin `playerId` client gửi: server điền theo ghế của socket.
- Quy tắc phòng (ai được vào, thêm bot, kick, đổi cài đặt, bắt đầu) nằm trong `packages/rooms` dưới dạng hàm thuần `applyRoomAction(room, action)`. Server chỉ lo socket, id, token và ngẫu nhiên. Chủ phòng rớt mạng thì quyền chủ phòng chuyển cho người khác đang online. Kick chỉ trong phòng chờ.
- Server **không bao giờ broadcast state đầy đủ**. Mỗi socket chỉ nhận view của ghế mình.
- Input không hợp lệ: trả lỗi cho riêng người gửi, state giữ nguyên.

### 5.2a Server (`apps/server`, checkpoint 12)

- `createGameServer(options)` (`src/game-server.ts`) gói HTTP + Socket.IO; `src/main.ts` đọc biến môi trường và lo `SIGTERM`.
- Mỗi socket ngồi tối đa một ghế (`socket.data = { code, seatId }`). Mở cùng ghế ở tab thứ hai thì tab mới thắng, tab cũ bị ngắt.
- Tin game gửi **riêng từng ghế**: `game:sync` (view, legal, log đã lọc) khi bắt đầu ván hoặc nối lại; `game:update` (view, legal, event đã lọc) sau mỗi lượt thay đổi. Server giữ log đầy đủ của ván và lọc lại theo ghế khi cần.
- Nối lại: `room:join` kèm `sessionToken` thì về đúng ghế cũ (kể cả giữa ván) và nhận `game:sync`. Tên gửi kèm bị bỏ qua.
- Phòng chờ: ghế rớt mạng được giữ **60 giây** rồi mới bị xoá. Phòng không còn người (chỉ còn bot) bị đóng ngay; phòng không ai online quá 10 phút bị dọn.
- Ván kết thúc (`GAME_OVER`) thì phòng chuyển sang `finished`. Chơi lại trong cùng phòng để sau MVP.
- Tên bot lấy theo theme của phòng, bằng ngôn ngữ của người tạo phòng (`locale` trong `room:create`).
- Giới hạn tần suất (token bucket theo socket, `src/rate-limit.ts`):

  | Loại | Sức chứa | Hồi lại |
  |---|---|---|
  | Tạo phòng | 3 | 1 phòng / 20 giây |
  | Thao tác phòng (vào, cài đặt, bot, kick, bắt đầu) | 10 | 2 / giây |
  | Nước đi | 20 | 10 / giây |
  | Sticker | 1 | 1 / 3 giây |

- Tối đa 500 phòng mở cùng lúc (`TOO_MANY_ROOMS`).
- Test tích hợp (`src/game-server.test.ts`) chạy server thật trên cổng ngẫu nhiên với `socket.io-client`. Có cả một ván trọn vẹn giữa 2 người tự chơi và 1 bot.

### 5.3 Rớt mạng & bot thay thế

1. Socket ngắt → ghế chuyển sang `disconnected`, ván vẫn chạy; tới lượt người đó thì timer xử lý như bình thường.
2. Sau **30 giây** chưa nối lại → `BotController` (độ khó Thường) **tạm điều khiển ghế**.
3. Người chơi nối lại bằng `sessionToken` → giành lại quyền điều khiển ngay.

### 5.4 Chống lạm dụng

- Rate limit theo socket (input, sticker, tạo phòng).
- Giới hạn số phòng đang mở và dọn phòng trống sau 10 phút.
- Nickname: giới hạn độ dài, lọc ký tự điều khiển.

## 6. Web app (`apps/web`)

- **Next.js 16.4 App Router**, chủ yếu client component cho màn chơi. Bật sẵn `cacheComponents` và `partialPrefetching` (mặc định của template); các trang tĩnh được prerender cho từng ngôn ngữ.
- **Styling:** Tailwind CSS v4. Design tokens khai báo bằng `@theme` trong `src/app/globals.css`, cùng các utility riêng: `text-game`, `text-game-sm`, `border-3`, `shadow-hard`. Font Baloo 2 qua `next/font` (subset `vietnamese`).
- **State UI:** `useSyncExternalStore` trên `GameHost` (xem §4.2). Không dùng Zustand vì host đã là nguồn state duy nhất. Hàng đợi event cho animation sẽ thêm ở checkpoint 10.
- **Animation:** Motion (Framer Motion). **Âm thanh:** Howler (giai đoạn sau).
- **i18n:** ngôn ngữ nằm trong URL (`/vi`, `/en`); link không có ngôn ngữ được `proxy.ts` tự chuyển hướng. Từ điển JSON tự viết, không dùng next-intl. Chi tiết: [decisions/0005](decisions/0005-locale-in-url.md). Tên nhân vật và tiền tệ lấy từ theme manifest theo ngôn ngữ hiện tại.
- **Package workspace** được import thẳng từ mã nguồn TypeScript (`transpilePackages` trong `next.config.ts`).
- **Asset theme:** `scripts/sync-theme-assets.mjs` copy `assets/themes/` vào `apps/web/public/themes/` trước `dev` / `build`. Bản copy không được commit.
- **Route:**

| Route | Nội dung | Trạng thái |
|---|---|---|
| `/[lang]` | Trang chủ: Chơi với bot · Tạo phòng · Vào phòng | ✅ |
| `/[lang]/play/local` | Thiết lập ván với bot rồi chơi luôn | ✅ Bàn chơi mobile hoàn chỉnh |
| `/[lang]/room/[code]` | Phòng chờ và bàn chơi online | Chưa làm |
| `/[lang]/rules` | Luật chơi minh họa | Chưa làm |

Link mời có thể bỏ tiền tố ngôn ngữ (`/room/ABCDE`); proxy sẽ thêm vào theo ngôn ngữ của người mở.

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
| Web | Vitest cho logic giao diện (`table-model`, `use-moments`, `LocalHost`, log) |
| Web (e2e) | Playwright, `pnpm e2e`: điện thoại giả lập (Pixel 7) trên Chrome có sẵn của máy. Chơi trọn một ván với bot qua giao diện, kiểm tra thông báo khi bấm nút mờ, và việc chuyển hướng ngôn ngữ. Build vào `.next-e2e` để không làm phiền `pnpm dev` đang chạy. Sẽ thêm: tạo phòng, 2 tab cùng vào |

## 9. Lộ trình triển khai

1. ✅ **Engine và test:** đủ luật, đạt toàn bộ test theo mã luật.
2. ✅ **Chơi local với bot:** `LocalHost`, giao diện bàn chơi **mobile dọc trước**, bot Dễ và Thường, animation, nhịp chơi.
3. **Online:** server, phòng, `SocketHost`, nối lại khi rớt mạng.
4. **Kết hợp:** thêm bot vào phòng online, bot tạm thay người rớt mạng, sticker. → **Hoàn thành MVP** (§1.1).
5. **Sau MVP:** bố cục desktop hoàn chỉnh, bot Khó, âm thanh, PWA, theme mới.

### 9.1 Kế hoạch bước 3–4 (chốt 2026-10-25)

| # | Checkpoint | Nội dung |
|---|---|---|
| 11 ✅ | Lõi điều phối dùng chung + giao thức | Tách phần điều phối ván khỏi `LocalHost` thành package dùng chung: hẹn giờ, bot suy nghĩ, tạm dừng khi có khoảnh khắc, lùi deadline. Server và client dùng chung, nên chơi online cùng nhịp với chơi bot. Thêm `packages/protocol` (schema zod cho mọi tin nhắn) và mô hình phòng thuần có test: phòng chờ, ghế, cài đặt, bắt đầu ván, kick |
| 12 ✅ | Server (`apps/server`) | Node + Socket.IO, phòng theo mã 5 ký tự, mỗi ghế chỉ nhận view của mình, nối lại bằng `sessionToken`, rate limit, test tích hợp bằng client giả |
| 13 | Giao diện online | Tạo phòng, vào bằng mã hoặc link mời, phòng chờ (ghế, cài đặt, thêm bot), `SocketHost`; bàn chơi dùng lại nguyên vẹn |
| 14 | Kết hợp và độ bền | Bot lấp ghế trống, bot tạm thay người rớt mạng sau 30 giây, sticker, e2e với 2 trình duyệt cùng phòng |
| 15 | Deploy | Server lên Fly.io (Singapore), web lên Vercel, biến môi trường, health check |

Các quyết định đi kèm:
- **Không có tài khoản** ở bản đầu: người chơi nhập tên; `sessionToken` lưu trên trình duyệt để nối lại.
- **Deploy ở checkpoint cuối (15):** làm và test hết ở máy trước. Cần tài khoản Fly.io, và xác thực Vercel khi tới bước đó.
- **Để sau MVP:** khán giả xem trận, chat chữ, chơi lại nhanh (rematch).

Deploy: xem [deployment.md](deployment.md).
