# Luật chơi

> Chibi Bluff dùng cơ chế của board game *Coup* (Rikki Tahta). Tên gọi và hình ảnh là của riêng dự án.

> Tài liệu này là **nguồn chuẩn** cho game engine. Mỗi quy tắc có mã (VD: `R-CH-3`) để test case và code có thể tham chiếu.
> Tên nhân vật/hành động giữ tiếng Anh làm định danh trong code. Tên hiển thị lấy từ theme đang dùng (VD: theme Giang Hồ gọi Duke là "Phú Hộ", coin là "lượng bạc") và được dịch qua i18n. Xem [ui-design.md §8](ui-design.md).

## 1. Tổng quan

- **Số người chơi:** 2–6.
- **Mục tiêu:** là người cuối cùng còn **influence** (lá bài úp).
- **Cốt lõi:** mỗi lá úp là một "mạng". Bạn có thể **tuyên bố** mình có bất kỳ nhân vật nào để dùng năng lực của nó — dù thật hay bluff. Người khác có thể **thách (challenge)** bạn.

## 2. Thành phần

| Thành phần | Số lượng |
|---|---|
| Court deck (bộ bài) | 15 lá: 5 nhân vật × 3 lá |
| Treasury (ngân khố) | Coin không giới hạn trong bản digital |

## 3. Chuẩn bị (Setup)

- `R-SU-1` Xáo bộ bài, chia mỗi người **2 lá úp**. Phần còn lại là court deck.
- `R-SU-2` Mỗi người nhận **2 coin**.
- `R-SU-3` Người đi đầu được chọn ngẫu nhiên. Lượt đi theo chiều kim đồng hồ.
- `R-SU-4` Ván **2 người**: người đi đầu chỉ nhận **1 coin** (cân bằng lợi thế đi trước).

## 4. Nhân vật

| Nhân vật | Hành động | Chặn được |
|---|---|---|
| **Duke** | **Tax:** lấy 3 coin | Foreign Aid |
| **Assassin** | **Assassinate:** trả 3 coin, mục tiêu mất 1 influence | — |
| **Captain** | **Steal:** lấy tối đa 2 coin từ mục tiêu | Steal |
| **Ambassador** | **Exchange:** rút 2 lá, chọn giữ, trả lại 2 lá | Steal |
| **Contessa** | — | Assassinate |

## 5. Hành động

Mỗi lượt, người chơi **bắt buộc** chọn đúng 1 hành động.

### 5.1 Hành động chung (không cần tuyên bố nhân vật → không thể bị challenge)

| Mã | Hành động | Hiệu ứng | Có thể bị chặn |
|---|---|---|---|
| `R-AC-1` | **Income** | +1 coin | Không |
| `R-AC-2` | **Foreign Aid** | +2 coin | Có — bởi **bất kỳ ai** tuyên bố Duke |
| `R-AC-3` | **Coup** | Trả 7 coin, mục tiêu mất 1 influence | Không, không thể challenge |

### 5.2 Hành động nhân vật (tuyên bố nhân vật → có thể bị challenge)

| Mã | Hành động | Hiệu ứng | Ai được chặn |
|---|---|---|---|
| `R-AC-4` | **Tax** (Duke) | +3 coin | Không ai |
| `R-AC-5` | **Assassinate** (Assassin) | Trả 3 coin, mục tiêu mất 1 influence | **Chỉ mục tiêu**, tuyên bố Contessa |
| `R-AC-6` | **Steal** (Captain) | Lấy `min(2, coin của mục tiêu)` | **Chỉ mục tiêu**, tuyên bố Captain hoặc Ambassador |
| `R-AC-7` | **Exchange** (Ambassador) | Rút 2 lá; từ (lá úp hiện có + 2 lá) giữ lại đúng số lá úp hiện có; trả phần còn lại; xáo bộ bài | Không ai |

### 5.3 Ràng buộc

- `R-AC-8` Có **≥ 10 coin** ở đầu lượt → **bắt buộc Coup**.
- `R-AC-9` Không thể chọn hành động không đủ tiền (Coup cần 7, Assassinate cần 3).
- `R-AC-10` Hành động có mục tiêu chỉ nhắm vào người **còn trong ván**, không phải bản thân.
- `R-AC-11` Chi phí (Coup, Assassinate) được **trả ngay khi tuyên bố**.

## 6. Challenge (Thách)

Mọi tuyên bố nhân vật — dù là **hành động** hay **lời chặn** — đều có thể bị challenge.

- `R-CH-1` **Bất kỳ người chơi nào còn trong ván** (không chỉ mục tiêu) đều có thể challenge. Nếu nhiều người cùng muốn, chỉ **người đầu tiên** được xử lý.
- `R-CH-2` Người bị thách phải chứng minh bằng cách lật lá nhân vật đã tuyên bố, hoặc thừa nhận không có.
- `R-CH-3` **Bluff bị bắt** (không có/không lật lá đúng):
  - Người bị thách mất 1 influence.
  - Hành động/lời chặn đó **thất bại**.
  - Nếu là hành động bị bắt bluff: **chi phí đã trả được hoàn lại** (VD: 3 coin Assassinate).
- `R-CH-4` **Challenge sai** (người bị thách có lá thật):
  - Người bị thách lật lá đó, **xáo lại vào court deck và rút 1 lá mới** (lá cũ không bị lộ vĩnh viễn).
  - Người thách mất 1 influence.
  - Hành động/lời chặn tiếp tục được thực hiện bình thường.
- `R-CH-5` Thứ tự khi challenge sai: người thách mất influence **trước**, người bị thách đổi lá **sau**.

## 7. Block (Chặn)

- `R-BL-1` Chỉ chặn được: Foreign Aid (Duke — bất kỳ ai), Assassinate (Contessa — chỉ mục tiêu), Steal (Captain/Ambassador — chỉ mục tiêu).
- `R-BL-2` Lời chặn là một tuyên bố nhân vật → **có thể bị challenge** bởi bất kỳ ai (kể cả người hành động).
- `R-BL-3` Lời chặn **không thể bị chặn ngược**.
- `R-BL-4` Chặn thành công (không bị challenge, hoặc challenge sai) → hành động thất bại. **Chi phí đã trả không được hoàn lại** (VD: Assassinate bị Contessa chặn vẫn mất 3 coin).
- `R-BL-5` Lời chặn bị bắt bluff → người chặn mất 1 influence **và** hành động gốc vẫn được thực hiện.

## 8. Mất influence

- `R-IN-1` Khi mất influence, **người chơi tự chọn** lá nào để lật ngửa.
- `R-IN-2` Lá đã lật nằm ngửa trước mặt, công khai cho mọi người, không dùng lại được.
- `R-IN-3` Hết lá úp → bị loại; coin trả về ngân khố; không còn lượt và không được challenge/chặn.
- `R-IN-4` Một người có thể mất **2 influence trong cùng một lượt**. VD:
  - Mục tiêu của Assassinate challenge sai → mất 1 lá, sau đó bị ám sát → mất thêm 1 lá.
  - Mục tiêu của Assassinate bluff Contessa bị bắt → mất 1 lá cho bluff, rồi ám sát thành công → mất thêm 1 lá.
- `R-IN-5` Nếu mục tiêu đã bị loại trước khi hành động được thực hiện (VD: mất lá cuối do challenge sai), hành động kết thúc mà không có hiệu ứng thêm. Chi phí không hoàn lại.

## 9. Trình tự một lượt (dùng cho state machine)

```
1. DECLARE_ACTION       Người chơi chọn hành động (+ mục tiêu). Trả chi phí.
   │                    Income / Coup → nhảy thẳng tới bước 6.
   ▼
2. ACTION_RESPONSE      Cửa sổ phản ứng (có giới hạn thời gian):
   │                    - Hành động nhân vật: người khác có thể CHALLENGE.
   │                    - Hành động chặn được: người hợp lệ có thể BLOCK.
   │                    - Hoặc tất cả PASS.
   ▼
3. RESOLVE_CHALLENGE    (nếu có challenge hành động) → R-CH-3 / R-CH-4.
   │                    Bluff bị bắt → kết thúc lượt.
   │                    Challenge sai → quay lại cửa sổ BLOCK (nếu hành động chặn được).
   ▼
4. BLOCK_RESPONSE       (nếu có block) Mọi người khác người chặn có thể CHALLENGE lời chặn, hoặc PASS.
   ▼
5. RESOLVE_BLOCK        Block đứng vững → hành động thất bại, kết thúc lượt.
   │                    Block bị bắt bluff → tiếp tục bước 6.
   ▼
6. EXECUTE_ACTION       Thực hiện hiệu ứng (nếu actor và mục tiêu còn hợp lệ).
   ▼
7. LOSE_INFLUENCE /     Các bước chọn lá (mất influence, chọn lá giữ khi Exchange)
   EXCHANGE_SELECT      chen vào bất cứ khi nào cần.
   ▼
8. END_TURN             Kiểm tra thắng thua → lượt người tiếp theo còn trong ván.
```

## 10. Kết thúc ván

- `R-EN-1` Ván kết thúc ngay khi chỉ còn 1 người có influence. Người đó thắng.

## 11. Quy định riêng cho bản digital

- `R-DG-1` Cửa sổ phản ứng có **thời gian đếm ngược** (mặc định 8 giây, chỉnh được trong phòng). Hết giờ = PASS.
- `R-DG-2` Cửa sổ kết thúc sớm khi **tất cả** người hợp lệ đã PASS.
- `R-DG-3` Bước chọn lá bỏ/giữ có thời gian riêng (mặc định 15 giây). Hết giờ → hệ thống chọn ngẫu nhiên.
- `R-DG-4` Khi một hành động được **thực hiện thật** (không bị challenge), lá của người tuyên bố **không** bị lộ.
- `R-DG-5` Lịch sử hành động (ai tuyên bố gì, ai thách ai, kết quả) được công khai trong log ván.
- `R-DG-6` Server chỉ gửi cho mỗi client **lá úp của chính họ**. Lá úp của người khác không bao giờ rời khỏi server.

## 12. Ngoài phạm vi (có thể làm sau)

- Bản mở rộng *Reformation* (phe phái, Inquisitor).
- Biến thể 2 người "chọn lá" (mỗi người chọn 2 trong 5 lá).
