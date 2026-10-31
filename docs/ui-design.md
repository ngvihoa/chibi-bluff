# Thiết kế UI

> Theme mặc định: **Giang Hồ Nhí Nhố** (id `giang-ho`). **Thiết kế mobile trước**, rồi mở rộng lên desktop. Preview sống: [design/concepts/giang-ho-preview.html](../design/concepts/giang-ho-preview.html)

## 1. Định hướng

- **Phong cách:** chibi phẳng, viền đậm, màu tươi trên nền tím than. Cảm giác game mobile vui nhộn, không phải board game cổ điển.
- **Cao trào là khoảnh khắc challenge:** mọi thiết kế chuyển động xoay quanh việc làm khoảnh khắc này thật kịch tính.
- **Thay nét mặt thật bằng sticker:** Game lừa bịp là game "đọc mặt", nên khi chơi online cần sticker để người chơi cà khịa nhau.

Lịch sử chọn hướng: [design/concepts/README.md](../design/concepts/README.md).

## 2. Design tokens

### 2.1 Màu giao diện

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--bg` | `#1c1a36` | Nền trang |
| `--panel` | `#2a2750` | Khối, hộp thoại |
| `--outline` | `#1d1230` | Mọi viền, bóng đổ chữ |
| `--ink` | `#fff6e6` | Chữ chính |
| `--muted` | `#bdb6e8` | Chữ phụ |
| `--gold` | `#ffd23f` | Điểm nhấn, ruy băng, huy hiệu, tiền |
| `--gain` | `#7ee08a` | Huy hiệu "được tiền" (`+n`) trên nút hành động |
| `--danger` | `#e5432f` | Nút Thách, cảnh báo |
| `--neutral-btn` | `#7d6f9c` → `#a99cc4` | Nút Bỏ qua |

### 2.2 Màu nhân vật (theme Giang Hồ)

| Role | Nhân vật | Màu viền | Nền panel (gradient) |
|---|---|---|---|
| duke | Phú Hộ | `#f2a81e` | `#fff6d6` → `#ffcf6e` |
| assassin | Ảnh Sát Thủ | `#6a4bc4` | `#f1eaff` → `#b6a0f0` |
| captain | Đệ Tử Cái Bang | `#3fae5a` | `#efffe2` → `#a6df86` |
| ambassador | Đạo Sĩ Xem Quẻ | `#2f8fe0` | `#e6f4ff` → `#94cbf5` |
| contessa | Nữ Hiệp Áo Trắng | `#e85d75` | `#fff1f4` → `#ffb0c0` |

Màu nhân vật luôn đi kèm **tên và icon huy hiệu**, không bao giờ là dấu hiệu duy nhất (để người mù màu vẫn phân biệt được).

### 2.3 Chữ

- **Font duy nhất:** Baloo 2 (Google Fonts, hỗ trợ đầy đủ tiếng Việt). Weight: 500 (chữ thường), 700 (nhấn), 800 (tiêu đề, nút, tên nhân vật).
- **Kiểu chữ game** (tiêu đề, nút, tên trên lá bài):
  ```css
  color: #fff;
  -webkit-text-stroke: 6px var(--outline);   /* 4px khi cỡ chữ < 20px */
  paint-order: stroke fill;
  text-shadow: 0 4px 0 var(--outline);
  ```
- Chữ thường (mô tả, log): `--ink` hoặc `--muted`, không viền.

### 2.4 Hình khối

- Viền đậm `--outline`: 4–6px ở kích thước lá bài chuẩn.
- Bo góc lớn: lá bài 28px, khối 22px, nút 16px.
- **Bóng đổ cứng:** `0 6px 0 var(--outline)` thay cho bóng mờ.

## 3. Lá bài

### 3.1 Cấu tạo (khung 300 × 450)

```
┌────────────────────────────┐  viền ngoài: màu nhân vật, bo 28, viền 6
│ (+3)                       │  huy hiệu năng lực: tròn vàng r=26 ở (46,46)
│   ┌────────────────────┐   │
│   │  tia sáng tỏa tròn │   │  panel 264×330: gradient + tia sáng trắng 22%
│   │    NHÂN VẬT        │   │  art: characters/<role>.svg (300×360)
│   └────────────────────┘   │
│ ◀══ Tên nhân vật ══▶       │  ruy băng vàng, tên Baloo 800 cỡ 27 (23 nếu > 15 ký tự)
│   Năng lực ngắn            │  Baloo 700 cỡ 15
└────────────────────────────┘
```

- Huy hiệu: `+3` (Duke), `−3` (Assassin), `+2` (Captain), mũi tên đổi (Ambassador), khiên (Contessa).
- **Chữ trên lá bài do app vẽ** (React component), không nằm trong file SVG nhân vật. Lý do:
  - Chữ đổi theo ngôn ngữ.
  - Font không tải được khi SVG được nhúng bằng `<img>`.
  - File `cards/*.vi.svg` chỉ dùng làm tham khảo và marketing.
- Mặt sau lá bài cũng vậy: `card-back.svg` chỉ có hình. Chữ "BLUFF" và nhãn theme (`cardBackLabel`) do app vẽ lên trên.
- **Component** (`apps/web/src/components/cards/`):
  - `CardFace`: props `theme`, `character` (role), `locale`, `ability`, cùng các cờ `lost`, `selected`, `owned`, `compact`.
  - `CardBack`: props `theme`, `locale`, `label`, `compact`.
  - `RoleBadge`: huy hiệu năng lực, theo luật nên giống nhau ở mọi theme.
  - Cả ba không dùng hook, nên dùng được trong cả Server Component lẫn Client Component.
  - Kích thước đặt bằng class bề ngang (VD `w-36`); chiều cao tự theo tỉ lệ 2:3.
- **Chế độ `compact`** cho ghế đối thủ nhỏ: chỉ còn khung và hình, bỏ huy hiệu, ruy băng và chữ, vì ở bề ngang ~48px chữ không đọc được.
- **Trang xem thử:** `/vi/dev/cards` (chỉ có khi chạy dev; bản production trả 404). Hiển thị mọi nhân vật, mọi trạng thái, mặt sau, chế độ compact và bài trên tay ở cỡ mobile.

### 3.2 Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Úp (của người khác) | `CardBack` |
| Úp (của mình) | Mặt trước, có icon mắt nhỏ ở góc nghĩa là "chỉ mình bạn thấy" |
| Đã lật (mất) | Mặt trước, grayscale 85%, độ sáng 60%, nghiêng 8° |
| Đang chọn (bỏ/giữ) | Nhấc lên 8px, viền vàng phát sáng |
| Hover | Nhấc lên 8px, nghiêng −2°, phóng to 1,03, chuyển động có độ nảy |

## 4. Bàn chơi

Thiết kế cho **điện thoại dọc trước** (360–430px), sau đó mở rộng lên tablet và desktop.

| Khoảng rộng | Bố cục |
|---|---|
| < 768px | Mobile dọc (§4.1): bố cục chính |
| 768–1023px | Bố cục mobile, phóng to, lá bài lớn hơn |
| ≥ 1024px | Bàn oval + cột diễn biến (§4.2) |

### 4.1 Mobile dọc (bố cục chính)

```
┌─────────────────────────────┐
│ [≡]   Lượt của Lan     [VI] │  thanh trên: menu, lượt hiện tại, ngôn ngữ
│ ┌───────┐┌───────┐┌───────┐ │
│ │ Minh  ││ Tuấn  ││ Lan ★ │ │  đối thủ: thẻ thu gọn, lưới 3 cột
│ │ 4 ▣▣  ││ 2 ▣▢  ││ 6 ▣▣  │ │  (avatar, tên, lượng bạc, 2 lá nhỏ)
│ └───────┘└───────┘└───────┘ │
│ ┌───────┐┌───────┐          │
│ └───────┘└───────┘          │
│                             │
│   Khung thông báo hành động │  sân khấu giữa + nén nhang
│                             │
│     [ lá 1 ]  [ lá 2 ]  💰5 │  bài của mình: to, mỗi lá ~36% bề ngang
│ [Income][Viện trợ][Thuế][Cướp]│
│ [Đổi bài][Ám sát][Coup][😀] │  thanh hành động: lưới 4×2, ô cuối là sticker
└─────────────────────────────┘
```

- **Thanh hành động là lưới 4×2, không cuộn ngang.** Cuộn sẽ giấu mất hành động. Ô thứ 8 là nút sticker.
- **Khung phản ứng** (Thách / Chặn / Bỏ qua) hiện thành **bottom sheet** đè lên thanh hành động, trong vùng ngón cái dễ bấm. Nút cao ≥ 56px.
- **Chọn mục tiêu:** chạm vào thẻ đối thủ. Thẻ hợp lệ sáng lên, thẻ không hợp lệ mờ đi.
- **Log ván:** vuốt lên từ mép dưới hoặc chạm nút ở thanh trên để mở dạng sheet.
- **Rung** (`navigator.vibrate`, nếu máy hỗ trợ) khi tới lượt mình và khi có kết quả challenge.
- Chừa vùng an toàn bằng `env(safe-area-inset-*)` cho tai thỏ và thanh home.
- Lề 16px, không cuộn ngang toàn trang, vùng chạm tối thiểu 44px.
- Điện thoại xoay ngang: v1 hiện lời nhắc "Xoay dọc để chơi".

**Đã cài đặt** (`apps/web/src/components/table/`):

| Component | Vai trò |
|---|---|
| `GameTable` | Ghép toàn bộ bàn chơi; làm việc với mọi `GameHost` |
| `OpponentSeat` | Thẻ đối thủ: avatar, tên, nhãn BOT, lượng bạc, 2 lá nhỏ. Viền vàng khi đang hành động; viền đỏ nhấp nháy khi chọn làm mục tiêu |
| `Stage` | Sân khấu giữa bàn: "X xưng" + tên và lá nhân vật đang được tuyên bố (hoặc lá dùng để chặn), dòng hiệu ứng ngắn ("Cướp: A → B") và diễn biến mới nhất |
| `ActionBar` | Lưới 4×2, thứ tự cố định. Hành động cần nhân vật hiện avatar của nhân vật đó; có huy hiệu tiền (vàng `−n` khi tốn tiền, xanh `+n` khi được tiền; Cướp ghi `+2` là tối đa) và icon mặt nạ khi bluff. Bấm nút mờ thì hiện thông báo lý do (thiếu tiền / phải Đảo chính / chưa tới lượt) |
| `BottomSheet` | Tấm trượt từ đáy cho: phản ứng (Thách + Bỏ qua cùng một hàng, các nút chặn mang màu nhân vật ở hàng dưới), chọn lá bỏ, đổi bài, chọn mục tiêu, và khi bạn đã bị loại ("Chơi ván mới" / "Xem tiếp") |
| `Incense` | Nén nhang chibi cháy theo deadline; 3 giây cuối đầu nhang chuyển đỏ và rung |
| `LogSheet` | Log đầy đủ dạng hộp thoại (`<dialog>`), mở từ nút cuộn giấy ở thanh trên |
| `Avatar` | Avatar tròn, cắt vùng đầu từ art nhân vật |

- Bài trên tay tự co theo không gian còn lại (container query), để tấm trượt cao nhất vẫn vừa màn hình 375×812.
- Thanh trên cùng **không** có nút đổi ngôn ngữ, vì đổi ngôn ngữ là chuyển trang và sẽ làm mất ván đang chơi. Nút rời bàn có hỏi xác nhận.
- Rung (`navigator.vibrate`) khi tới lượt bạn và khi có kết quả challenge.
- Phần logic "nút nào bật, vì sao tắt, có phải bluff không" nằm trong `apps/web/src/game/table-model.ts` và có test riêng.
- **Lưu ý khi test bằng tay ở chế độ dev:** nút công cụ "N" của Next.js nằm đè góc dưới bên trái, trùng chỗ nút Thách / Thu nhập. Bản production không có nút này.

### 4.2 Desktop (≥ 1024px) — chốt 2026-10-31, đã làm ở checkpoint 21

Trước đây desktop hiển thị bố cục mobile ở giữa màn hình (rộng tối đa 448px). Bố cục mới chỉ đổi **bàn chơi**; các trang khác (trang chủ, thiết lập ván, phòng chờ, luật chơi) vẫn là cột giữa như mobile, vì chúng ngắn và đọc tốt ở bề rộng đó. Khoảng 768–1023px vẫn dùng bố cục mobile.

```
┌───────────────────────────────────────────────────────────────┬──────────────┐
│ [rời]          Lượt 3 · Lan               [lá đã lộ] [?]      │  Diễn biến    │
│        ╭──────────────────────────────────────────────────╮   │  · Lan Thu    │
│      ╭─╯  [Minh]      [Tuấn]       [Lan ★]      [Hoa]      ╰─╮ │    thuế +3    │
│      │         (ghế xếp theo vòng cung phía trên bàn)       │ │  · Minh thách │
│      │   0/3 0/3 1/3 0/3 0/3          (bảng lá đã lộ)        │ │  · …          │
│      │        ┌──────────────────────────────┐   ▣▣ 7        │ │              │
│      │        │  sân khấu: ai xưng gì, kết quả │   bộ bài      │ │  (log luôn   │
│      │        └──────────────────────────────┘               │ │   hiện, tự   │
│      │              [ lá 1 ]  [ lá 2 ]   💰 5                 │ │   cuộn)      │
│      ╰──────────────────────────────────────────────────────╯ │              │
│   [Thu nhập][Viện trợ][Đảo chính][Thuế][Ám sát][Cướp][Đổi][😀] │              │
└───────────────────────────────────────────────────────────────┴──────────────┘
```

- **Mặt bàn hình bầu dục** (nền tím đậm, viền vàng nhạt) chiếm phần chính; bàn rộng tối đa khoảng 1100px, căn giữa màn hình.
- **Đối thủ** xếp thành vòng cung ở mép trên bàn: ghế giữa cao hơn, hai đầu thấp dần. Thẻ ghế to hơn mobile (avatar, tên, lượng bạc, 2 lá nhỏ đọc rõ). Từ 1 tới 5 đối thủ đều cân đối.
- **Sân khấu** ở giữa bàn, rộng tối đa khoảng 560px, chồng bài chung đặt bên phải; bảng "lá đã lộ" ngay dưới hàng ghế.
- **Bài của bạn** ở mép dưới bàn, chiều cao cố định (khoảng 240px) thay vì co theo chỗ trống như mobile.
- **Thanh hành động** thành **một hàng 8 ô** (7 hành động + sticker) dưới bàn, rộng tối đa khoảng 860px. Các bảng phản ứng, chọn lá, chọn mục tiêu vẫn trượt lên từ đáy nhưng chỉ rộng bằng thanh hành động, không phủ hết màn hình.
- **Diễn biến** là một cột bên phải (khoảng 320px), **luôn hiện** và tự cuộn tới dòng mới nhất. Nút mở log ở thanh trên ẩn đi trên desktop.
- **Rê chuột** vào nút hành động đang mờ thì hiện lý do (thiếu tiền / phải Đảo chính / chưa tới lượt) dạng tooltip; chạm vẫn hiện thông báo như mobile.
- Các lớp phủ toàn màn hình (khoảnh khắc thách, bốc lá thay, hết ván, Luật nhanh) giữ nguyên.
- Cách làm: cùng một cây component cho mọi kích thước. Bố cục desktop dùng class `lg:` của Tailwind (vùng mặt bàn dùng `display: contents` trên mobile để không đổi bố cục cũ); không đo kích thước bằng JS, nên không lệch giao diện khi render phía server. Bố cục mobile giữ nguyên hoàn toàn.
- Kiểm tra: ảnh chụp ở 1280×800 và 1920×1080 với 2, 4 và 6 người; e2e chơi trọn một ván ở 1280×800; các e2e mobile hiện có không đổi.

**Đã làm (checkpoint 21):**
- `GameTable`: cột chính + cột diễn biến (`LogPanel` trong `log-sheet.tsx`, ẩn dưới 1024px). Vùng mặt bàn là một `div` với `contents lg:flex …`: dưới 1024px nó không tạo hộp nên bố cục mobile y như cũ.
- Ghế đối thủ: dưới 1024px vẫn là lưới tối đa 3 cột; từ 1024px là hàng `flex` căn giữa, mỗi ghế rộng 224px (256px từ 1536px, co lại khi đông người) và hạ xuống theo `arcOffset(index, count)` (`table-model.ts`, có test) để thành vòng cung, tối đa 72px ở hai đầu. Độ hạ là `margin-top` chứ không phải `translate`, nên hàng ghế chiếm đúng chỗ và không đè lên hàng lá đã lật. Ghế từ 1024px to hơn trên mobile (avatar 48px, lá 48px). Khi ghế hẹp hơn 13rem (container query), avatar xếp trên tên để tên không bị cắt.
- Bàn cách mép màn hình 16px, mặt bàn cách header và thanh hành động 16px; lề ngang trong mặt bàn 32px, 80px từ 1280px.
- Bài trên tay cao `clamp(11rem, 28dvh, 21rem)`; sân khấu rộng tối đa 640px; thanh hành động và các bảng trượt rộng tối đa 860px; mặt bàn tối đa 1100px; cả bàn và cột diễn biến tối đa 1440px.
- Nút hành động đang mờ có `title` là lý do (tooltip khi rê chuột).
- E2E `desktop-table.spec.ts`: ở 1280×800, cột diễn biến hiện và nút mở log ẩn, 8 ô của thanh hành động cùng một hàng, nút mờ có lý do, chơi trọn một ván và log có nhiều dòng.

### 4.3 Chung cho mọi kích thước

- Ghế đối thủ: avatar chibi (cắt từ art), tên, nhãn `BOT` nếu là bot, số lượng bạc, 2 lá nhỏ.
- Người đang đến lượt: viền vàng phát sáng quanh ghế.
- Ghế rớt mạng: mờ 50%, kèm icon wifi gạch chéo; khi bot thay thế thì hiện nhãn "Bot đang giữ ghế".

### 4.4 Thanh hành động

- Mỗi nút gồm: icon nhân vật (hoặc icon chung), tên hành động, số tiền mất hoặc được.
- Thiếu tiền → nút mờ; chạm vào thì hiện lý do (trên desktop là tooltip khi rê chuột).
- ≥ 10 lượng bạc → chỉ còn nút Coup được bấm (luật `R-AC-8`).
- **Chỉ báo bluff:** nút cần tuyên bố một nhân vật mà mình **không** cầm sẽ có icon mặt nạ nhỏ. Người chơi luôn biết mình đang bluff (người khác không thấy icon này). Có thể tắt trong cài đặt.
- Hành động có mục tiêu: bấm nút → các ghế hợp lệ sáng lên → bấm ghế để chọn.

### 4.5 Khung phản ứng

- Dòng chữ, VD: "**Phú Hộ** (Lan) muốn **Thu thuế +3**".
- Nút:
  - **Thách!** (đỏ)
  - **Chặn bằng [nhân vật]** (màu nhân vật). Nếu có 2 nhân vật chặn được, như Steal, thì hiện 2 nút.
  - **Bỏ qua** (xám)
- Đồng hồ: **nén nhang chibi** cháy dần theo thời gian còn lại. 3 giây cuối nhang chuyển đỏ và rung nhẹ.

## 5. Chuyển động

Dùng Motion. Mặc định các chuyển động có độ nảy (spring), không dùng ease thẳng.

| Khoảnh khắc | Chuyển động | Thời lượng |
|---|---|---|
| Chia bài | Lá bay từ giữa bàn ra từng ghế, lần lượt cách nhau 80ms | ~1,2s |
| Nhận tiền | Nén bạc bay từ ngân khố (giữa bàn) về ghế, con số đếm lên | 500ms |
| Cướp tiền | Nén bạc bay từ ghế này sang ghế kia | 500ms |
| Tuyên bố | Lá nhân vật được tuyên bố hiện to ở khung giữa, nảy vào | 300ms |
| **Challenge** | (1) Màn hình tối 40% và **im lặng** 400ms → (2) lá của người bị thách lật chậm 600ms → (3) kết quả | ~1,5s |
| ↳ Bluff bị bắt | Con dấu đỏ "**Lộ tẩy!**" đập xuống, nhân vật chibi giật mình đổ mồ hôi, rung lá | 600ms |
| ↳ Hàng thật | Con dấu vàng "**Hàng thật!**", tia sáng tỏa ra, lá bay về bộ bài và rút lá mới | 800ms |
| Mất influence | Lá lật ngửa, chuyển xám, nghiêng | 400ms |
| Bị loại | Ghế mờ dần, avatar chuyển xám | 600ms |
| Thắng ván | Pháo giấy màu nhân vật + nhân vật chibi của người thắng nhảy lên | 2s |

- Tôn trọng `prefers-reduced-motion`: thay bằng fade ngắn, bỏ rung.
- Event từ engine được xếp **hàng đợi** và chạy lần lượt; input của người chơi vẫn được nhận trong lúc animation chạy.

**Đã cài đặt:**

| Khoảnh khắc | Cách làm | Thời lượng |
|---|---|---|
| Chia bài | Hai lá trên tay bay vào (lá thứ hai trễ 120ms) | 500ms |
| Thay đổi lượng bạc | Số `+3` / `−2` bay lên từ ghế (`CoinFloats`); không hiện khi tiền bị trả lại lúc bị loại | 1,2s |
| Challenge | Lớp phủ tối và mờ nền → lá nhân vật lật vào (sau 400ms) → con dấu **"Lộ tẩy!"** (đỏ, lá xám) hoặc **"Hàng thật!"** (vàng, lá phát sáng) đập xuống (sau 1s) | 1,7s, chạm để bỏ qua |
| Bị loại | Chữ "X bị loại!" bật lên giữa màn hình; ghế mờ dần | 0,9s |
| Mất lá | Lá lật lên (`flip-in`) rồi chuyển xám, nghiêng | 500ms |
| Thắng ván | Pháo giấy màu nhân vật, avatar người thắng nhún nhảy; nút xem lại diễn biến | — |

- Hàng đợi nằm trong hook `useMoments` (`apps/web/src/game/use-moments.ts`). State ván luôn là mới nhất; khoảnh khắc chỉ là lớp phủ.
- `LocalHost` **tạm dừng bot** bằng đúng thời lượng các khoảnh khắc trong lần cập nhật đó (`MOMENT_MS`), để người chơi kịp xem kết quả trước khi bot đi tiếp:

  | Sự kiện | Tạm dừng |
  |---|---|
  | Kết thúc một lượt | 1,5s |
  | Có người tuyên bố chặn | 0,7s |
  | Kết quả challenge | 1,7s |
  | Có người bị loại | 0,9s |

- **Tóm tắt lượt:** trong khoảng nghỉ sau một lượt, sân khấu đổi sang khung viền vàng "Vừa xong", kể lại lượt vừa rồi. Ví dụ "Thu thuế thành công: Lão Tiền +3 lượng", "Tiểu Ảnh chặn được Viện trợ của Lão Tiền", "Cướp thành công: Lão Tiền cướp của Thanh Phong". Khung biến mất khi khoảng nghỉ hết hoặc khi người kế tiếp đã tuyên bố hành động.
- **Nhịp chơi** (màn hình thiết lập), mặc định là Vừa:

  | Nhịp | Bot suy nghĩ và tạm dừng | Thời gian phản ứng | Thời gian chọn lá |
  |---|---|---|---|
  | Thong thả | ×1,6 | 25 giây | 30 giây |
  | Vừa | ×1 | 15 giây | 20 giây |
  | Nhanh | ×0,55 | 10 giây | 15 giây |

- `LocalHost` lùi deadline của phase mở ra trong lúc có khoảnh khắc, để người chơi không mất giờ trong lúc xem animation.
- Cạnh nén nhang có hiện số giây còn lại; 3 giây cuối chuyển sang màu đỏ.
- Tham số `?speed=0.1` trên `/play/local` ghi đè nhịp chơi (bot nhanh gấp 10 lần), dùng cho test e2e.

## 5b. Hoàn thiện chơi với bot (đã làm ở checkpoint 10b)

Ghi lại ngày 2026-10-25. Làm trước bước online.

| Mục | Trạng thái |
|---|---|
| **Bảng "lá đã lộ"**: mỗi nhân vật đã bị lật mấy lá trên 3 (VD "Phú Hộ 2/3"). Thông tin vốn công khai, chỉ gom lại cho dễ nhìn, giúp người mới đếm bài | ✅ Chốt, có công tắc bật/tắt |
| **Chồng bài chung** trên bàn. Số lá (15 − 2 × số người) không đổi suốt ván, nên chủ yếu để có chỗ cho lá bay ra vào | ✅ Chốt |
| **Animation lá bay** giữa chồng bài và ghế: khi Đổi bài (rút 2 / trả 2), khi thắng challenge (lá đã chứng minh xáo vào, rút lá mới) | ✅ Chốt |
| **Báo riêng khi bài của bạn được thay** sau khi thắng challenge: "Bạn rút lá mới: …" (chỉ bạn thấy). Hiện lá trên tay đổi hình mà không báo | ✅ Chốt, đi cùng animation ở trên |
| **Thầy Bói (Inquisitor, bản mở rộng Reformation)**: nhìn được bài người khác | ✅ Giữ luật gốc cho MVP; Thầy Bói là tùy chọn phòng **sau MVP** |
| **Tự bốc lá thay thế** sau khi thắng challenge (`R-DG-8`): chồng bài xòe ra các lá úp, chạm chọn một lá, rồi lá đó lật lên chỉ cho bạn xem. 15 giây, hết giờ chọn ngẫu nhiên. Làm thật trong engine (phase mới), không phải hiệu ứng giả. Không áp dụng cho Đổi bài | ✅ Chốt |

Cách làm:

- **Bảng lá đã lộ**: một hàng chip (avatar + `n/3`) dưới hàng đối thủ; đủ 3/3 thì chip mờ đi. Nút bật/tắt ở thanh trên cùng, nhớ theo máy (`localStorage`), mặc định bật.
- **Chồng bài chung**: nằm cạnh khu sân khấu, 3 lá úp chồng lệch nhau, có huy hiệu số lá.
- **Lá bay**: lá úp bay theo đường vòng cung giữa chồng bài và ghế (600 ms, các lá cách nhau 140 ms). Khi có challenge thì đợi overlay challenge chạy xong mới bay. Tắt khi máy bật giảm chuyển động.
- **Bốc lá thay thế**: màn toàn phần (mở sau khi overlay challenge chạy xong), không dùng bottom sheet, vì lúc này không cần nhìn bàn và bộ bài có tới 12 lá. Quy tắc chung: bottom sheet cho lựa chọn cần nhìn bàn (thách, bỏ lá, giữ lá khi Đổi bài); màn toàn phần cho bước không cần thông tin trên bàn.
  1. **Xòe** (~1,2 giây): bàn tối lại; thanh trên cùng ghi "Bạn có thật X · Bốc 1 lá mới" và nhang 15 giây. Các lá úp bay từ chồng bài ra, xếp hàng 4 lá, căn giữa. Có ≤ 3 lá thì xếp 1 hàng với lá to hơn.
  2. **Lật** (~2,6 giây): lá vừa chạm phóng to ra giữa rồi lật ngửa, tên nhân vật hiện sau khi lật xong; các lá còn lại mờ đi. Chạm nền để qua bước này sớm.
  3. **Về tay** (~1 giây): lá mới bay vào ô trống trên tay, các lá kia bay về chồng bài.
  - Hết giờ: máy chọn ngẫu nhiên, vẫn chạy bước 2 và 3. Bot bốc thì không mở màn này.
  - Bot được giữ lại suốt bước 2–3 (`MOMENT_MS.drew` = 3,6 giây). Trong lúc chọn, ô của lá đã chứng minh trên tay để trống (viền chấm) và chồng bài đếm cả lá đó, cho khớp luật "lá đã xáo vào bộ bài"; ghế đối thủ đang bốc cũng hiện ô trống. Nhật ký ghi "Bạn rút lá mới: …" hoặc "X rút lá mới".
- Trang dev `/<lang>/dev/table` (chỉ chạy khi dev) dựng sẵn tình huống bốc lá để xem giao diện mà không cần chờ trong ván thật.

## 6. Sticker

- Mỗi theme có 5 sticker, mỗi nhân vật một cái. Giang Hồ: "Hehe~", "Nói dối!", "Lêu lêu~", "Thiên cơ…", "Thách!"
- Bấm nút sticker → bảng chọn → sticker bay lên từ ghế mình, hiện 2,5 giây.
- Cooldown 3 giây cho mỗi người. Có thể tắt sticker của người khác trong cài đặt.
- **Đã làm (checkpoint 14):** nút Sticker trên thanh hành động mở bottom sheet với 5 sticker (avatar nhân vật + câu thoại của theme) và ô "Ẩn sticker của người khác" (nhớ theo máy). Sticker hiện thành bong bóng trắng ngay dưới ghế đối thủ, hoặc cạnh số tiền của mình. Chơi với bot cũng gửi được, nhưng chỉ mình thấy. Ảnh sticker hoàn chỉnh trong `assets/themes/*/stickers/` vẫn chỉ để tham khảo.

## 7. Âm thanh (giai đoạn sau)

Tiếng nén bạc leng keng, tiếng lật bài, tiếng trống khi challenge, "bụp" khi lộ tẩy, chuông khi tới lượt mình. Nhạc nền kiểu nhạc cụ dân tộc vui tươi. Tắt/bật riêng nhạc và hiệu ứng.

## 8. Hệ thống theme

### 8.1 Cấu trúc thư mục

```
assets/themes/<id>/
├── theme.json              tên, tiền tệ, màu, đường dẫn asset (song ngữ)
├── characters/<role>.svg   art nhân vật, không chữ, viewBox 300×360
├── cards/<role>.vi.svg     lá hoàn chỉnh để tham khảo (không dùng trong app)
├── stickers/<role>.vi.svg  sticker hoàn chỉnh để tham khảo
├── card-back.svg           mặt sau, không chữ (chữ do app vẽ)
├── currency.svg            icon tiền tệ
├── tax-gold.svg            icon hành động thu thuế
└── background.svg          hình nền trang chủ / sảnh chờ
```

Schema manifest: xem [theme.json của Giang Hồ](../assets/themes/giang-ho/theme.json). Package `@chibi-bluff/themes` đọc và kiểm tra manifest lúc khởi động (`defineTheme`): thiếu nhân vật, sai mã màu hoặc thiếu bản dịch sẽ báo lỗi ngay, kèm thông báo cụ thể. Test của package còn kiểm tra mọi đường dẫn asset đều trỏ tới file có thật.

Mỗi nhân vật có thêm `botName`: biệt danh cho bot nhập vai nhân vật đó. Test của package bảo đảm biệt danh không trùng tên nhân vật nào.

`currency` là dạng dùng trong câu (tiếng Anh dùng số nhiều: "taels"), VD "Trả 3 lượng" / "Pay 3 taels".

### 8.2 Quy ước vẽ nhân vật

Áp dụng cho mọi theme để các bộ đồng nhất:
- **Khung vẽ** 300 × 360. Đầu tròn tâm khoảng (150, 172), bán kính ~78. Thân nhỏ từ y≈252, cắt ở y≈352.
- **Tỉ lệ chibi:** đầu chiếm khoảng 55% chiều cao nhân vật.
- **Viền** `#1d1230`, dày 4–5px; chi tiết nhỏ 3px.
- **Mắt:** elip đen to, 2 đốm sáng trắng. Biểu cảm thể hiện qua lông mày và miệng.
- **Má hồng** `#ff7a8e`, độ mờ 55%. Da `#ffdcbf`.
- **Đạo cụ** gợi ý năng lực: tiền (Duke), vũ khí (Assassin), đồ vừa cướp được (Captain), vật để đổi hoặc rút (Ambassador), vật để che chắn (Contessa).
- **Vùng đầu** (x 66–234, y 80–256) phải đọc rõ khi cắt riêng, vì dùng cho avatar và sticker.

### 8.3 Quy trình asset hiện tại

Art đang được vẽ bằng code trong trang preview. Sau khi sửa preview thì chạy:

```bash
node scripts/export-giang-ho-assets.mjs
```

Script ghi đè các file trong `assets/themes/giang-ho/`. Khi có họa sĩ, file SVG do họa sĩ vẽ sẽ thay thế trực tiếp, chỉ cần giữ đúng khung vẽ và quy ước ở §8.2.

### 8.4 Ý tưởng theme tiếp theo

Vương Quốc Mèo, Truyền Thuyết Việt, Thủy Cung, Tạp Hóa Tí Hon, Lớp Học Nhốn Nháo, Vùng Đất Phép Thuật, Kỷ Nguyên Robot. Bảng nhân vật đầy đủ ở [design/concepts/README.md](../design/concepts/README.md).

## 9. Song ngữ

- Mọi chữ giao diện nằm trong `apps/web/src/i18n/dictionaries/vi.json` và `en.json`. Tên nhân vật và tiền tệ lấy từ theme manifest.
- Tiếng Việt thường dài hơn tiếng Anh khoảng 20–30%. Thiết kế nút và ruy băng theo **bản tiếng Việt**, tự giảm cỡ chữ khi tên dài (như quy tắc > 15 ký tự ở §3.1).
- Nút đổi ngôn ngữ VI/EN đặt ở góc trên phải của mọi trang. Lựa chọn được nhớ trong cookie, để link mời không có ngôn ngữ cũng mở đúng ngôn ngữ đã chọn ([decisions/0005](decisions/0005-locale-in-url.md)).

## 10. Trang luật chơi (chốt 2026-10-29; đã làm ở checkpoint 19–20)

Ba phần, mỗi phần cho một nhu cầu:

| Phần | Cho ai | Dạng |
|---|---|---|
| **Học chơi trong 2 phút** | Người mới, lần đầu | Storyboard: nhiều trang vuốt ngang như story, mỗi trang một ý kèm một cảnh minh hoạ |
| **Tra cứu luật** | Người đã chơi, cần xem lại một điểm | Một trang cuộn, các mục có neo (`#...`), bảng nhân vật, hỏi–đáp |
| **Mẹo chiến thuật** | Người đã biết luật, muốn chơi hay hơn | Danh sách thẻ, chia "Cho người mới" và "Nâng cao" |

Lý do không gộp thành một trang: storyboard tốt để **học lần đầu** nhưng kém để **tra cứu**; trang chữ dài thì ngược lại. Luật đầy đủ có nhiều trường hợp đặc biệt, nhồi vào story sẽ quá dài.

### 10.1 Route và lối vào

| Route | Nội dung |
|---|---|
| `/[lang]/rules` | Trang chung: 3 thẻ lớn dẫn tới 3 phần |
| `/[lang]/rules/learn` | Storyboard; mỗi trang có địa chỉ riêng `#1` … `#10` để chia sẻ |
| `/[lang]/rules/reference` | Tra cứu luật |
| `/[lang]/rules/tips` | Mẹo chiến thuật |

Lối vào:
- **Trang chủ:** nút "Luật chơi" (chuỗi `home.rules` đã có sẵn) → `/rules`.
- **Thiết lập ván với bot:** dòng nhỏ "Chưa biết chơi? Học trong 2 phút" → `/rules/learn`.
- **Lần đầu bấm "Chơi"** (chưa từng xem storyboard, nhớ bằng `localStorage`): gợi ý một lần, có nút bỏ qua. Không chặn người đã biết chơi.
- **Trên bàn chơi** (bước 2): nút "?" ở thanh trên cùng mở mục tra cứu đúng với tình huống. Ví dụ đang ở bảng phản ứng thì mở `#challenge`.

### 10.2 Học chơi trong 2 phút (storyboard)

Giao diện:
- Toàn màn hình, thanh tiến độ chia đoạn ở trên cùng, nút đóng ×.
- Chạm 1/3 trái để lùi, 2/3 phải để tới; vuốt ngang; phím ← →; nút "Tiếp" ở dưới.
- **Không tự chuyển trang** như story mạng xã hội: người học đọc theo nhịp của mình.
- Mỗi trang gồm: tiêu đề chữ game, 1–2 câu, một **cảnh** dựng từ chính component của bàn chơi (`CardFace`, `CardBack`, `Avatar`, `Coins`, `Stamp`, chip hành động). Người học thấy đúng những gì sẽ gặp khi chơi.
- Cảnh có chuyển động ngắn (lật lá, lượng bay, dấu "Lộ tẩy!"). Khi máy bật giảm chuyển động thì chỉ hiện trạng thái cuối.

Tên nhân vật và tiền tệ lấy từ theme (Phú Hộ, Ảnh Sát Thủ, Đệ Tử Cái Bang, Đạo Sĩ Xem Quẻ, Nữ Hiệp Áo Trắng; lượng bạc).

| # | Tiêu đề | Ý chính | Cảnh minh hoạ | Luật |
|---|---|---|---|---|
| 1 | Người cuối cùng thắng | Mỗi người có 2 lá úp = 2 mạng. Mất hết lá là bị loại. Còn lại cuối cùng là thắng | 3 avatar; 2 người lần lượt mờ đi, người còn lại nhảy lên cùng pháo giấy | `R-IN-3` |
| 2 | Bài của bạn | Bộ bài có 5 nhân vật, mỗi nhân vật 3 lá. Bài của bạn chỉ mình bạn thấy | 2 lá úp có biểu tượng con mắt; bên dưới là hàng 5 nhân vật | `R-SU-1` |
| 3 | Lượng bạc | Bắt đầu với 2 lượng. Tiền để Ám sát (3) và Đảo chính (7) | Ô tiền đếm từ 2 lên; chip giá −3 và −7 | `R-SU-2`, `R-AC-9` |
| 4 | Mỗi lượt một hành động | Tới lượt, bạn chọn đúng 1 hành động | Thanh hành động, các nút sáng lần lượt | §5 |
| 5 | Ai cũng làm được | Thu nhập +1. Viện trợ +2 (có thể bị chặn). Đảo chính: trả 7, mục tiêu mất 1 lá, không ai chặn được. Có từ 10 lượng thì bắt buộc Đảo chính | 3 chip hành động chung với huy hiệu +1, +2, −7 | `R-AC-1..3`, `R-AC-8` |
| 6 | Xưng nhân vật | Muốn dùng năng lực nhân vật thì **xưng** có lá đó, dù thật hay không. Xưng mà không có là **bluff**, và đó là luật chứ không phải gian lận | 5 lá nhân vật xoè ra kèm năng lực; một lá úp có mặt nạ bluff | §4, §1 |
| 7 | Thách! | Ai cũng có thể thách lời xưng. Người bị thách không có lá: **Lộ tẩy**, họ mất 1 lá. Có thật: **Hàng thật**, người thách mất 1 lá, người kia bốc lá mới | Phú Hộ xưng Thu thuế, người khác bấm "Thách!", lá lật lên. Hai kết quả đặt cạnh nhau với dấu đỏ và dấu vàng | `R-CH-1..4`, `R-DG-8` |
| 8 | Chặn | Phú Hộ chặn Viện trợ; Đệ Tử Cái Bang và Đạo Sĩ Xem Quẻ chặn Cướp; Nữ Hiệp chặn Ám sát. Lời chặn cũng là xưng nhân vật, nên cũng có thể bị thách | Ám sát nhắm vào bạn, bạn bấm "Chặn bằng Nữ Hiệp"; bên dưới là bảng ai chặn gì | `R-BL-1..2` |
| 9 | Mất lá | Mất 1 mạng thì bạn chọn lật 1 lá. Lá ngửa công khai cho mọi người, và bảng "Lá đã lộ" đếm giúp bạn | Chạm chọn 1 trong 2 lá, lá lật ngửa; chip "Lá đã lộ" tăng 1/3 | `R-IN-1..2` |
| 10 | Sẵn sàng! | Vậy là đủ để chơi. Xem thêm tra cứu khi cần | Nút "Chơi với bot" (gợi ý độ khó Dễ), "Tra cứu luật", "Mẹo chiến thuật" | — |

### 10.3 Tra cứu luật

Nguồn chuẩn là [game-rules.md](game-rules.md): mọi câu trên trang phải khớp luật ở đó. Mã luật ghi trong docs để đối chiếu, không hiện cho người chơi.

| Mục (neo) | Nội dung | Luật |
|---|---|---|
| `#overview` | 2–6 người; mục tiêu; chuẩn bị (2 lá, 2 lượng; ván 2 người thì người đi đầu chỉ có 1 lượng) | §1, `R-SU-*` |
| `#characters` | Bảng 5 nhân vật kèm hình lá: hành động, chặn được gì | §4, §5.2 |
| `#actions` | Thu nhập, Viện trợ, Đảo chính; bắt buộc Đảo chính khi có từ 10 lượng; không đủ tiền thì không chọn được; chi phí trả ngay khi xưng | `R-AC-*` |
| `#challenge` | Ai được thách (chỉ người thách đầu tiên được tính); lộ tẩy và hàng thật; bluff hành động bị bắt thì được hoàn chi phí; bốc lá mới sau khi chứng minh | `R-CH-*`, `R-DG-8` |
| `#block` | Ai chặn gì; lời chặn có thể bị thách; không chặn ngược được; chặn thành công thì chi phí **không** được hoàn | `R-BL-*` |
| `#influence` | Tự chọn lá để lật; bị loại; mất 2 lá trong một lượt (ví dụ Ám sát + thách sai, Ám sát + bluff Nữ Hiệp bị bắt) | `R-IN-*` |
| `#timers` | Thời gian phản ứng và chọn lá theo nhịp chơi; giới hạn chọn hành động khi chơi online | `R-DG-1`, `R-DG-3`, `R-DG-7` |
| `#faq` | Hỏi–đáp các tình huống hay hỏi (danh sách chốt khi viết, lấy từ các ví dụ trong game-rules) | — |

Mục lục dính ở đầu trang (cuộn ngang trên điện thoại) để nhảy nhanh giữa các mục.

### 10.4 Mẹo chiến thuật

Mỗi mẹo là một thẻ: tiêu đề, 1–2 câu, một ví dụ cụ thể, và liên kết "Xem luật" tới mục tra cứu liên quan. Mẹo nào nói về luật phải được đối chiếu với game-rules.md.

**Cho người mới**

| # | Mẹo | Ý chính | Liên kết |
|---|---|---|---|
| 1 | Bluff là một phần của game | Không có Phú Hộ vẫn có thể xưng Phú Hộ để Thu thuế +3. Đầu ván ít người dám thách, vì thách sai mất lá | `#challenge` |
| 2 | Đếm bài trước khi thách | Mỗi nhân vật chỉ có 3 lá. Ví dụ: bảng "Lá đã lộ" ghi Phú Hộ 2/3 và lá Phú Hộ thứ ba nằm trên tay bạn, vậy ai xưng Phú Hộ chắc chắn đang bluff | `#characters` |
| 3 | Thách có giá | Thách sai mất 1 lá, còn người kia chỉ đổi lá chứ không mất gì. Thách khi lời xưng gây hại trực tiếp cho bạn (Ám sát, Cướp) hoặc khi đếm bài thấy rất khả nghi | `#challenge` |
| 4 | Canh mốc 7 và 10 lượng | Có 7 lượng là Đảo chính được, không ai chặn được. Người có 7 lượng trở lên là mối đe doạ lớn nhất; có 10 lượng thì bắt buộc Đảo chính | `#actions` |
| 5 | Nhắm vào người dẫn đầu | Cướp hoặc Ám sát người nhiều tiền hay còn đủ 2 lá, đừng để ai bỏ xa | `#actions` |

**Nâng cao**

| # | Mẹo | Ý chính | Liên kết |
|---|---|---|---|
| 6 | Giữ câu chuyện nhất quán | Đã xưng Phú Hộ thì tiếp tục chơi như Phú Hộ. Đổi nhân vật liên tục dễ bị nghi và bị thách | — |
| 7 | Bluff Nữ Hiệp khi bị Ám sát | Nếu bị thách và lộ tẩy, bạn mất **cả 2 lá** trong lượt đó. Nhưng khi chỉ còn 1 lá thì không chặn cũng thua, nên bluff chẳng mất gì thêm | `#influence` |
| 8 | Đổi bài để làm mới tay bài | Bị nghi quá nhiều, hoặc lá đã lộ hết cặp, thì Đổi bài (Đạo Sĩ Xem Quẻ) để làm mới và xem thêm 2 lá trong bộ | `#characters` |
| 9 | Thách lời chặn | Lời chặn cũng là xưng nhân vật. Bị chặn Cướp bởi người vừa thua một lá Đệ Tử Cái Bang? Đếm bài rồi thách | `#block` |
| 10 | Đọc bot | Bot Dễ thật thà, ít thách. Bot Thường đếm bài và bluff có tính toán. Mỗi bot có tính cách theo nhân vật: Ảnh Sát Thủ hung hăng, Phú Hộ thận trọng, Đệ Tử Cái Bang hay bluff, Nữ Hiệp nhớ thù, Đạo Sĩ cân bằng | — |

### 10.5 Kỹ thuật

- Nội dung nằm trong từ điển vi/en (`rules.*`); tên nhân vật và tiền tệ chèn từ theme.
- `/rules`, `/rules/reference`, `/rules/tips` là trang tĩnh, prerender cho từng ngôn ngữ. Storyboard là client component.
- **Storyboard:**
  - cuộn ngang bằng CSS scroll-snap, không thêm thư viện;
  - mẫu carousel có trợ năng: mỗi trang `aria-roledescription="slide"`, nút lùi/tới có nhãn, thanh tiến độ là các nút nhảy trang;
  - đồng bộ `#n` với `history.replaceState`.
- **Test:**
  - unit cho logic chuyển trang (chạm, phím, hash);
  - e2e: đi hết storyboard tới nút "Chơi với bot", mở các neo của trang tra cứu, đổi ngôn ngữ.

### 10.6 Đã làm ở checkpoint 19

- `/rules` (`app/[lang]/rules/page.tsx`): 2 thẻ Học chơi và Tra cứu; thẻ Mẹo chiến thuật hiện "Sắp có".
- `/rules/learn`:
  - `components/rules/storyboard.tsx` với 10 cảnh trong `components/rules/scenes.tsx`; logic chuyển trang thuần trong `story-nav.ts` (có test).
  - Cảnh chỉ chạy chuyển động ở trang đang xem và chạy lại mỗi lần quay về; trang khác thì tắt chuyển động.
  - Mở đúng trang theo `#n` khi tải trang. Hash được đọc **một lần**, vì ở chế độ dev React chạy effect hai lần và lần thứ hai sẽ đọc phải hash do chính component vừa ghi. Đổi hash trên cùng trang (link nội bộ, nút Back) cũng chuyển trang (`hashchange`).
  - Trang cuối có nút "Chơi với bot" và "Tra cứu luật".
  - Bấm Lùi/Tiếp (hay chạm, hay phím) thì đổi trang **ngay**, kể cả khi khung còn đang trượt: trang đích được giữ trong `heading`, các trang lướt qua trên đường không tính, lần bấm sau đi tiếp từ trang đích. Ngón tay chạm khung thì thao tác vuốt giành lại quyền.
  - Vị trí chạm (1/3 trái là lùi) đo theo khung chứa, không theo trang bị chạm (trang đó có thể đang lệch khi trượt).
  - Vị trí cuộn của trang `n` là `n × chiều rộng khung` (mỗi trang rộng đúng bằng khung). Không dùng `offsetLeft`: trên màn hình rộng, storyboard được căn giữa nên `offsetLeft` cộng thêm lề trái, làm trang hiện lệch so với thanh tiến độ. E2E có thêm một test ở màn hình 1280 px, và các test kiểm tra tiêu đề trang nằm hẳn trong khung nhìn (`toBeInViewport`), không chỉ "đang hiện".
  - Nút Back của trình duyệt rời storyboard về trang trước (hash được thay bằng `replaceState`, không tạo mục lịch sử cho từng trang), giống cách đóng một story.
- `/rules/reference`: trang tĩnh, mục lục dính ở đầu (cuộn ngang), bảng nhân vật có avatar, 8 mục với neo `#overview` … `#faq`.
- Lối vào: nút "Luật chơi" ở trang chủ; dòng "Chưa biết chơi? Học trong 2 phút" ở màn thiết lập ván với bot.
- Nội dung trong `rules.*` của từ điển vi/en, tên nhân vật và tiền tệ chèn từ theme.
- `CardFace` và `Avatar` nhận thêm `style` (dùng cho độ trễ chuyển động lệch nhau).
- E2E `rules.spec.ts`: đi hết storyboard tới ván với bot; mở thẳng `#7`, dùng phím mũi tên và chạm 1/3 trái; tra cứu bằng tiếng Anh cùng mục lục; liên kết từ màn thiết lập ván.

### 10.6b Đã làm ở checkpoint 20

- `/rules/tips` (`app/[lang]/rules/tips/page.tsx`): 10 mẹo ở §10.4 chia "Cho người mới" (1–5) và "Nâng cao" (6–10); mỗi thẻ có ví dụ, mẹo nào dựa vào luật thì có link "Xem luật" tới mục tra cứu. Thẻ Mẹo ở trang `/rules` đã mở.
- Nút **"?"** trên thanh trên cùng của bàn chơi (`help-sheet.tsx`):
  - mở bảng **Luật nhanh** ngay trên bàn, ván vẫn chạy bên dưới;
  - mục luật chọn bằng `helpTopic(view)` theo tình huống, chụp lúc bấm nên không đổi khi bảng đang mở. Hành động → `actions`, cửa sổ thách hành động hoặc bốc lá thay → `challenge`, cửa sổ thách lời chặn → `block`, chọn lá bỏ → `influence`, đổi bài → `characters`, hết ván → `overview`;
  - link "Xem toàn bộ luật" mở **tab mới**, vì ván với bot nằm trong tab hiện tại, rời trang là mất ván.
- Nội dung mỗi mục tra cứu tách ra `components/rules/reference-section.tsx`, dùng chung cho trang tra cứu và bảng Luật nhanh.
- **Gợi ý lần đầu** (`learn-hint.tsx`): người chưa từng mở storyboard thấy một khung "Lần đầu chơi?" (Học ngay / Bỏ qua) ở màn thiết lập ván với bot hoặc màn Chơi online, **chỉ một lần** (`localStorage` `chibi-bluff:learn-hint`). Mở storyboard cũng đánh dấu đã xem.
- E2E: trang mẹo và link sang tra cứu; nút "?" mở đúng bảng và link; gợi ý chỉ hiện một lần; đã xem storyboard thì không hiện.

### 10.7 Chia việc

| Bước | Nội dung |
|---|---|
| 1 | Storyboard 10 trang, trang tra cứu, trang `/rules`, lối vào từ trang chủ và màn thiết lập ván với bot |
| 2 | Mẹo chiến thuật, nút "?" trên bàn chơi dẫn tới mục tra cứu đúng tình huống, gợi ý xem storyboard ở lần đầu bấm "Chơi" |

