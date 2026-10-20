# Thiết kế UI

> Theme mặc định: **Giang Hồ Kiếm Hiệp**. Preview sống: [design/concepts/giang-ho-preview.html](../design/concepts/giang-ho-preview.html)

## 1. Định hướng

- **Phong cách:** chibi phẳng, viền đậm, màu tươi trên nền tím than. Cảm giác game mobile vui nhộn, không phải board game cổ điển.
- **Cao trào là khoảnh khắc challenge:** mọi thiết kế chuyển động xoay quanh việc làm khoảnh khắc này thật kịch tính.
- **Thay nét mặt thật bằng sticker:** Coup là game "đọc mặt", nên khi chơi online cần sticker để người chơi cà khịa nhau.

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

### 3.2 Trạng thái

| Trạng thái | Hiển thị |
|---|---|
| Úp (của người khác) | `card-back.svg` |
| Úp (của mình) | Mặt trước, có icon mắt nhỏ ở góc nghĩa là "chỉ mình bạn thấy" |
| Đã lật (mất) | Mặt trước, grayscale 85%, độ sáng 60%, nghiêng 8° |
| Đang chọn (bỏ/giữ) | Nhấc lên 8px, viền vàng phát sáng |
| Hover | Nhấc lên 8px, nghiêng −2°, phóng to 1,03, chuyển động có độ nảy |

## 4. Bàn chơi

### 4.1 Desktop (≥ 1024px)

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

- Ghế đối thủ: avatar chibi (cắt từ art), tên, nhãn `BOT` nếu là bot, số lượng bạc, 2 lá nhỏ.
- Người đang đến lượt: viền vàng phát sáng quanh ghế.
- Ghế rớt mạng: mờ 50%, kèm icon wifi gạch chéo; khi bot thay thế thì hiện nhãn "Bot đang giữ ghế".

### 4.2 Mobile (< 768px)

- Đối thủ xếp thành lưới 2–3 cột ở trên, dạng thu gọn (avatar, coin, 2 lá nhỏ).
- Khung thông báo hành động ở giữa.
- Bài của mình và thanh hành động ở dưới, thanh hành động cuộn ngang.
- Lề 16px, không cuộn ngang toàn trang, vùng chạm tối thiểu 44px.

### 4.3 Thanh hành động

- Mỗi nút gồm: icon nhân vật (hoặc icon chung), tên hành động, chi phí.
- Thiếu tiền → nút mờ, kèm tooltip lý do.
- ≥ 10 lượng bạc → chỉ còn nút Coup được bấm (luật `R-AC-8`).
- **Chỉ báo bluff:** nút cần tuyên bố một nhân vật mà mình **không** cầm sẽ có icon mặt nạ nhỏ. Người chơi luôn biết mình đang bluff (người khác không thấy icon này). Có thể tắt trong cài đặt.
- Hành động có mục tiêu: bấm nút → các ghế hợp lệ sáng lên → bấm ghế để chọn.

### 4.4 Khung phản ứng

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
├── card-back.svg
├── currency.svg            icon tiền tệ
├── tax-gold.svg            icon hành động thu thuế
└── background.svg          hình nền trang chủ / sảnh chờ
```

Schema manifest: xem [theme.json của Giang Hồ](../assets/themes/giang-ho/theme.json).

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

- Mọi chữ giao diện nằm trong `messages/vi.json` và `messages/en.json`. Tên nhân vật và tiền tệ lấy từ theme manifest.
- Tiếng Việt thường dài hơn tiếng Anh khoảng 20–30%. Thiết kế nút và ruy băng theo **bản tiếng Việt**, tự giảm cỡ chữ khi tên dài (như quy tắc > 15 ký tự ở §3.1).
- Nút đổi ngôn ngữ VI/EN đặt ở góc trên phải của mọi trang.
