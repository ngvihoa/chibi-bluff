# Bot AI

> Package: `packages/bots`. Phụ thuộc duy nhất: `packages/engine`.

## 1. Nguyên tắc

1. **Không gian lận:** bot chỉ nhận `PlayerView` của ghế mình, giống hệt một người chơi. Bot không bao giờ đọc `GameState` đầy đủ.
2. **Không phe phái:** bot không biết ghế nào là người, ghế nào là bot. Việc chọn mục tiêu không được dùng thông tin này, để các bot không "hùa" nhau đánh người thật.
3. **Không chia sẻ trí nhớ:** mỗi bot có bộ nhớ riêng; các bot không trao đổi thông tin.
4. **Giống người:** có thời gian suy nghĩ, có tính cách, có chút ngẫu nhiên, đôi khi gửi sticker.

## 2. Interface

```ts
interface BotPolicy {
  decide(ctx: BotContext): Decision
}

interface BotContext {
  view: PlayerView          // những gì ghế này được thấy
  legal: PlayerInput[]      // các input hợp lệ lúc này (từ engine.getLegalInputs), không rỗng
  memory: BotMemory         // bộ nhớ riêng của bot, sống suốt ván
  personality: Personality
  rng: RngState             // trạng thái PRNG có seed của riêng bot
}

interface Decision {
  input: PlayerInput
  rng: RngState             // trạng thái PRNG mới: bot là hàm thuần, host lưu lại cho lần sau
  thinkMs: number           // thời gian "suy nghĩ" gợi ý
}
```

- **Bộ nhớ** được cập nhật bằng `observe(memory, events)`. Host gọi hàm này sau mỗi input, với các event **đã lọc theo ghế của bot** (`getEventsForViewer`). Bộ nhớ là dữ liệu thuần JSON, nên server lưu được trong phòng chơi.
- `BotController` (xem [architecture.md](architecture.md) §4) gọi `decide`, rồi **chờ `thinkMs`** (0,5–2,5 giây) trước khi gửi input. Thời gian chờ dài hơn khi quyết định "khó", VD: bị ám sát khi chỉ còn 1 lá.
- Mã nguồn: `memory.ts`, `belief.ts`, `easy.ts`, `normal.ts`, `random.ts` (bot ngẫu nhiên làm mốc so sánh, không cho người chơi chọn), `sim/` (giả lập).

## 3. Các điểm cần quyết định

| Tình huống | Lựa chọn |
|---|---|
| Đến lượt mình | Chọn hành động (+ mục tiêu) |
| Người khác tuyên bố nhân vật | Challenge hoặc Pass |
| Hành động chặn được nhắm vào mình / Foreign Aid | Block (bằng role nào) hoặc Pass |
| Có người chặn | Challenge lời chặn hoặc Pass |
| Phải mất influence | Bỏ lá nào |
| Exchange | Giữ lá nào |

## 4. Mô hình niềm tin (Belief)

Mỗi bot ước lượng `P(o có role r)` cho từng đối thủ `o`.

### 4.1 Đếm bài (chắc chắn)

```
unseen[r] = 3 − (số lá r mình đang cầm) − (số lá r đã lật ngửa)
U         = tổng unseen = lá trong bộ bài + lá úp của mọi đối thủ
```

Nếu `unseen[r] = 0` thì **không ai** có thể đang cầm `r`: mọi tuyên bố `r` chắc chắn là bluff.

### 4.2 Xác suất nền (hypergeometric)

Đối thủ có `k` lá úp, rút ngẫu nhiên từ `U` lá chưa thấy:

```
P₀(o có ít nhất 1 lá r) = 1 − C(U − unseen[r], k) / C(U, k)
```

### 4.3 Cập nhật theo hành vi

Nhân **odds** của `P₀` với các hệ số:

| Bằng chứng | Hệ số odds (Thường) |
|---|---|
| `o` tuyên bố `r`, không ai thách | × 1,6 mỗi lần, tối đa × 4 |
| `o` chặn bằng `r` | × 1,6 |
| `o` né một hành động mà `r` chặn được (VD: bị Steal mà không chặn) | × 0,6 với Captain và Ambassador |
| `o` vừa thắng challenge với `r` | Lá đó đã bị xáo lại vào bộ bài: **reset** về P₀, bỏ mọi bằng chứng cũ của `o` về `r` |
| `o` vừa Exchange | Giảm một nửa độ tin của mọi bằng chứng cũ về `o` |

Bot cũng ghi nhận **tỉ lệ bluff bị bắt** của từng đối thủ. Người hay bị bắt bluff sẽ bị tin ít hơn: hệ số tuyên bố giảm còn × 1,2.

**Lời tuyên bố đang diễn ra cũng là bằng chứng.** Khi quyết định có thách hay không, odds được nhân thêm `1 / tỉ lệ bluff ước lượng` của người đó:

```
tỉ lệ bluff ước lượng = (số lần bị bắt bluff + 1) / (số lần bị bắt bluff + số lần lật lá thật + 3)
```

Ban đầu khoảng 1/3, tức hệ số × 3. Hệ số này tự điều chỉnh theo lịch sử từng người. Thiếu bước này, bot đánh giá thấp người nói thật và thách quá tay. Đây là lỗi chính của phiên bản đầu tiên: chỉ hòa bot Dễ, 51%.

**Xu hướng thách của từng đối thủ** được học từ số lần thách trên số lần *có cơ hội* thách:

```
challengeRate(o) = (số lần o thách + 1) / (số cơ hội thách của o + 8),   kẹp trong [0,03; 0,6]
```

## 5. Ra quyết định (độ khó Thường)

Mỗi lựa chọn được tính **giá trị kỳ vọng (EV)**, sau đó chọn theo softmax với nhiệt độ `τ` (tính ngẫu nhiên của bot):

```
P(chọn a) ∝ exp(EV(a) / τ)
```

### 5.1 Giá trị một lá bài

Giá trị một influence phụ thuộc mình còn bao nhiêu lá:
- Còn 2 lá: `CARD_VALUE = 6` (tính theo đơn vị coin).
- Còn 1 lá: `CARD_VALUE = 20`, vì mất lá cuối là thua.

### 5.2 Chọn hành động

```
EV(a) = Gain(a) × P(thành công) − Cost(a) − P(bị bắt bluff) × CARD_VALUE
```

| Hành động | Gain | P(thành công) xấp xỉ |
|---|---|---|
| Income | 1 | 1 |
| Foreign Aid | 2 | 1 − P(có người chặn bằng Duke) |
| Tax | 3 | 1 nếu không bị bắt |
| Steal | `min(2, coin mục tiêu)` × 2 (mình được, địch mất) | 1 − P(mục tiêu có Captain/Ambassador) × xu hướng chặn |
| Assassinate | Giá trị hạ 1 lá của mục tiêu (cao hơn nếu mục tiêu còn 1 lá) | 1 − P(mục tiêu có Contessa) × xu hướng chặn |
| Coup | Như Assassinate, chắc chắn thành công | 1 |
| Exchange | Mức cải thiện kỳ vọng của bộ bài | 1 nếu không bị bắt |

`P(bị bắt bluff)` chỉ khác 0 khi bot **không** cầm role đó:

```
P(bị bắt bluff) = 1 − Π_o (1 − min(0,9; challengeRate(o) × (1 + 0,7 × số lá r đã lật)))
```

- **Mục tiêu** của hành động tấn công phản kháng mạnh hơn: `challengeRate × 2`.
- **Mục tiêu chỉ còn 1 lá bị ám sát** thì không còn gì để mất: xác suất thách tối thiểu 0,6, và xác suất chặn (kể cả bluff Contessa) cộng thêm 0,4. Thiếu bước này, bot bluff Ám sát quá nhiều.

**Quy tắc cứng** (bỏ qua EV):
- ≥ 10 coin → bắt buộc Coup (luật `R-AC-8`).
- ≥ 7 coin và có đối thủ còn 1 lá → ưu tiên Coup người đó.

### 5.3 Chọn mục tiêu

```
Threat(o) = coin(o) × 0,5 + số lá úp(o) × 3 + (coin(o) ≥ 7 ? 5 : 0) + thù_hằn(o)
```

`thù_hằn(o)` tăng khi `o` vừa tấn công mình. Hệ số này nhân với `personality.vindictive`.

### 5.4 Challenge

```
P_lie = 1 − P(o có r)
EV(challenge) = P_lie × Lợi(hành động bị hủy + đối thủ mất lá) − (1 − P_lie) × CARD_VALUE
```

Challenge khi `EV > 3,5 − 2 × personality.aggression` (tính cách cân bằng: ngưỡng 2,7).

Ngưỡng được chọn bằng giả lập. Ngưỡng cao hơn còn thắng bot Dễ nhiều hơn chút ít (ngưỡng 5: 72,3%), vì bot Dễ hầu như nói thật. Nhưng một bot gần như không bao giờ thách sẽ bị người chơi hay bluff bắt nạt, nên mình giữ mức giữa và để mô hình niềm tin tự thích nghi.

**Quy tắc cứng:**
- `unseen[r] = 0` → luôn challenge.
- Bị Assassinate khi chỉ còn 1 lá:
  - Có Contessa → Block.
  - Không có → so sánh hai đường: bluff Contessa (thua nếu bị thách) và challenge Assassin (thua nếu họ có thật). Chọn đường có xác suất sống cao hơn.

### 5.5 Block

- Có role chặn được → luôn Block (trừ khi `personality` muốn giấu bài và thiệt hại nhỏ).
- Không có → bluff Block khi `EV(bluff) = Thiệt hại tránh được × (1 − P(bị thách)) − P(bị thách) × CARD_VALUE > 0`.

### 5.6 Bỏ lá / giữ lá (Exchange)

Chấm điểm từng lá theo tình huống, rồi bỏ lá điểm thấp nhất (hoặc giữ tổ hợp điểm cao nhất):
- **Contessa:** cao khi có đối thủ ≥ 3 coin và từng tuyên bố Assassin.
- **Duke:** cao khi mình ít coin.
- **Captain / Ambassador:** cao khi bị Steal nhiều.
- **Assassin:** cao khi mình ≥ 3 coin.
- **Nhất quán với tuyên bố cũ:** +2 điểm cho lá mình từng tuyên bố, để những lần bluff sau vẫn đáng tin.
- **Exchange:** ưu tiên giữ hai lá **khác loại**.

## 6. Độ khó

| | Dễ | Thường | Khó |
|---|---|---|---|
| Đếm bài | Không | Có | Có |
| Mô hình niềm tin | Không | §4 | §4 |
| Ra quyết định | Gần ngẫu nhiên trong các lựa chọn an toàn | EV + softmax (§5) | Mô phỏng Monte Carlo (§7) |
| Nhiệt độ `τ` | 3,0 | 1,0 | 0,3 |
| Bluff | Hiếm | Theo tính cách | Theo tính cách, có tính toán |
| Thời gian tính | ~0 | < 5 ms | ≤ 300 ms (chạy trong Web Worker ở chế độ local) |

## 7. Độ khó Khó: Determinized Monte Carlo

1. Lấy mẫu **N = 200** cách chia bài cho các lá ẩn, theo trọng số niềm tin ở §4. Mỗi mẫu là một "thế giới" có đầy đủ thông tin.
2. Với mỗi lựa chọn hợp lệ, trong mỗi thế giới: áp lựa chọn đó, rồi chơi tiếp đến hết ván (hoặc tối đa 6 lượt) bằng policy Thường cho mọi người. Ván chưa kết thúc thì chấm điểm bằng hàm đánh giá (số lá, coin).
3. Chọn lựa chọn có **tỉ lệ thắng trung bình** cao nhất.
4. Dừng khi hết **ngân sách thời gian**, lấy kết quả tốt nhất tính được tới lúc đó.

Engine deterministic và thuần nên có thể clone state và chạy mô phỏng mà không ảnh hưởng ván thật.

## 8. Tính cách

```ts
interface Personality {
  bluffRate: number      // 0..1: sẵn sàng tuyên bố role mình không có
  aggression: number     // 0..1: xu hướng challenge
  riskTolerance: number  // 0..1: chấp nhận mạo hiểm khi còn 1 lá
  vindictive: number     // 0..1: trả đũa người vừa tấn công mình
  chatty: number         // 0..1: tần suất gửi sticker
}
```

Preset gắn với nhân vật theme để bot có "vai": VD bot tên "Đệ Tử Cái Bang" hay bluff, bot "Đạo Sĩ" thận trọng. Tên và avatar bot lấy từ theme.

## 9. Sticker

Bot gửi sticker theo sự kiện với xác suất `chatty`, có cooldown ≥ 8 giây:
- Bắt được bluff → "Nói dối!"
- Thắng challenge → "Hehe~"
- Cướp thành công → "Lêu lêu~"
- Bị nhắm làm mục tiêu → "Thách!"

## 10. Kiểm thử

- **Unit:** các quy tắc cứng (luôn challenge khi `unseen = 0`; bắt buộc Coup ở 10 coin; không bao giờ chọn input ngoài `legal`).
- **Chống gian lận:** test bảo đảm hàm `decide` chỉ nhận `PlayerView`. Thêm lint rule cấm `packages/bots` import kiểu `GameState`.
- **Giả lập:** chạy hàng loạt ván bot đấu bot, xuất bảng tỉ lệ thắng giữa các độ khó và tính cách. Mỗi ván xếp lại chỗ ngồi ngẫu nhiên để không bên nào được lợi thế đi trước. Mục tiêu: Khó thắng Thường ≥ 60%, Thường thắng Dễ ≥ 70% (đấu 1 chọi 1).

  ```bash
  pnpm bots:sim --bots easy,random --games 1000
  ```

  Tham số: `--bots` (danh sách độ khó, mỗi mục một ghế), `--games`, `--personality`, `--seed`.

  | Kết quả hiện tại | Tỉ lệ thắng |
  |---|---|
  | Dễ vs Ngẫu nhiên (2 người, 1.000 ván) | Dễ 72% |
  | 2 Dễ + 2 Ngẫu nhiên (4 người, 500 ván) | Phe Dễ 89% |
  | **Thường vs Dễ** (2 người, 2.000 ván, cân bằng) | **Thường 72%** ✅ mục tiêu ≥ 70% |
  | Thường vs Dễ, tính cách hay bluff / thận trọng / hiếu chiến | 73% / 74% / 69% |
  | 1 Thường + 3 Dễ (4 người, 1.500 ván) | Thường 49% (chia đều: 25%) |
  | 1 Thường + 5 Dễ (6 người, 1.000 ván) | Thường 50% (chia đều: 17%) |

- **Phân tích hành vi** khi tinh chỉnh (bot nào bluff bao nhiêu, thách đúng / sai bao nhiêu lần):

  ```bash
  pnpm --filter @chibi-bluff/bots exec tsx src/sim/diagnose.ts normal,easy 1000
  ```
