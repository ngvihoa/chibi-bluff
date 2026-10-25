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
| ≥ 1024px | Bàn oval (§4.2) |

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
| `ActionBar` | Lưới 4×2, thứ tự cố định. Hành động cần nhân vật hiện avatar của nhân vật đó; có huy hiệu chi phí và icon mặt nạ khi bluff. Bấm nút mờ thì hiện thông báo lý do (thiếu tiền / phải Đảo chính / chưa tới lượt) |
| `BottomSheet` | Tấm trượt từ đáy cho: phản ứng (Thách + Bỏ qua cùng một hàng, các nút chặn mang màu nhân vật ở hàng dưới), chọn lá bỏ, đổi bài, chọn mục tiêu, và khi bạn đã bị loại ("Chơi ván mới" / "Xem tiếp") |
| `Incense` | Nén nhang chibi cháy theo deadline; 3 giây cuối đầu nhang chuyển đỏ và rung |
| `LogSheet` | Log đầy đủ dạng hộp thoại (`<dialog>`), mở từ nút cuộn giấy ở thanh trên |
| `Avatar` | Avatar tròn, cắt vùng đầu từ art nhân vật |

- Bài trên tay tự co theo không gian còn lại (container query), để tấm trượt cao nhất vẫn vừa màn hình 375×812.
- Thanh trên cùng **không** có nút đổi ngôn ngữ, vì đổi ngôn ngữ là chuyển trang và sẽ làm mất ván đang chơi. Nút rời bàn có hỏi xác nhận.
- Rung (`navigator.vibrate`) khi tới lượt bạn và khi có kết quả challenge.
- Phần logic "nút nào bật, vì sao tắt, có phải bluff không" nằm trong `apps/web/src/game/table-model.ts` và có test riêng.
- **Lưu ý khi test bằng tay ở chế độ dev:** nút công cụ "N" của Next.js nằm đè góc dưới bên trái, trùng chỗ nút Thách / Thu nhập. Bản production không có nút này.

### 4.2 Desktop (≥ 1024px)

*Chưa làm (sau MVP).* Hiện tại desktop hiển thị bố cục mobile ở giữa màn hình (rộng tối đa 448px).


```
          [đối thủ]   [đối thủ]   [đối thủ]
   [đối thủ]                              [đối thủ]
               ┌──────────────────────┐
               │ Khung thông báo hành  │   ← nén nhang đếm ngược
               │ động + nút phản ứng   │
               └──────────────────────┘
                    [lá 1] [lá 2]   lượng bạc
     [Thanh hành động: Income · Foreign Aid · Coup · Tax · Steal · Assassinate · Exchange]
                                                   [log] [sticker]
```

### 4.3 Chung cho mọi kích thước

- Ghế đối thủ: avatar chibi (cắt từ art), tên, nhãn `BOT` nếu là bot, số lượng bạc, 2 lá nhỏ.
- Người đang đến lượt: viền vàng phát sáng quanh ghế.
- Ghế rớt mạng: mờ 50%, kèm icon wifi gạch chéo; khi bot thay thế thì hiện nhãn "Bot đang giữ ghế".

### 4.4 Thanh hành động

- Mỗi nút gồm: icon nhân vật (hoặc icon chung), tên hành động, chi phí.
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
- **Bốc lá thay thế**: bottom sheet "Bốc 1 lá mới" với các lá úp xòe hàng ngang và nhang đếm 15 giây. Trong lúc chọn, ô của lá đã chứng minh trên tay để trống (viền chấm) và chồng bài đếm cả lá đó, cho khớp luật "lá đã xáo vào bộ bài"; ghế đối thủ đang bốc cũng hiện ô trống. Bốc xong hiện khoảnh khắc "Bạn rút được: …" (chỉ bạn thấy); nhật ký ghi "Bạn rút lá mới: …" hoặc "X rút lá mới".
- Trang dev `/<lang>/dev/table` (chỉ chạy khi dev) dựng sẵn tình huống bốc lá để xem giao diện mà không cần chờ trong ván thật.

## 6. Sticker

- Mỗi theme có 5 sticker, mỗi nhân vật một cái. Giang Hồ: "Hehe~", "Nói dối!", "Lêu lêu~", "Thiên cơ…", "Thách!"
- Bấm nút sticker → bảng chọn → sticker bay lên từ ghế mình, hiện 2,5 giây.
- Cooldown 3 giây cho mỗi người. Có thể tắt sticker của người khác trong cài đặt.

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
