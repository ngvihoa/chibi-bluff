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
| Ra quyết định | Gần ngẫu nhiên trong các lựa chọn an toàn | EV + softmax (§5) | PIMC trên các thế giới đoán bài (§7; thắng ISMCTS trong giả lập) |
| Nhiệt độ `τ` | 3,0 | 1,0 | 0,3 |
| Bluff | Hiếm | Theo tính cách | Theo tính cách, có tính toán |
| Thời gian tính | ~0 | < 5 ms | ≤ 300 ms mỗi nước, trong Web Worker |
| Có ở đâu | Chơi với bot, phòng online | Chơi với bot, phòng online | **Chỉ chơi với bot** (chốt 2026-11-01): phòng online chạy bot trên server Cloudflare, gói miễn phí không đủ CPU cho mỗi nước 300 ms |

## 7. Độ khó Khó: ISMCTS (checkpoint 29–30, chốt kế hoạch 2026-11-01)

**Mục tiêu:** thắng bot Thường **≥ 60%** khi đấu 1 chọi 1 (giả lập), mỗi nước **≤ 300 ms**, chỉ có khi chơi với bot. Bot Khó vẫn theo §1: chỉ thấy `PlayerView` của ghế mình, không biết ghế nào là người, trí nhớ riêng.

### 7.1 Vì sao không dừng ở Monte Carlo "nhiều thế giới" (PIMC)

Bản phác đầu tiên là PIMC: đoán N cách chia bài, thử từng lựa chọn trong mỗi thế giới rồi để bot Thường chơi tiếp. Cách này dễ, nhưng có ba điểm yếu:

- Mỗi thế giới được tính riêng, nên bot chọn nước tốt "trung bình", đôi khi như thể biết bài đối thủ (*strategy fusion*).
- Thời gian chia đều cho mọi lựa chọn, kể cả nước rõ ràng tệ.
- Chỉ nhìn một nước, không thấy chuỗi như "bluff bây giờ để lượt sau ám sát".

Các hướng mạnh hơn đã cân nhắc:

| Cách | Kết luận |
|---|---|
| **ISMCTS** (Information Set MCTS, Cowling và cộng sự, 2012) | **Chọn.** Một cây tìm kiếm chung cho mọi thế giới; dồn thời gian vào nước hứa hẹn; nhìn sâu nhiều lượt; làm cho game giấu bài nhiều người |
| CFR (như bot poker) | Bỏ: cần đơn giản hóa game và huấn luyện offline lâu; với 3–6 người gần như không áp dụng được |
| Học tăng cường (mạng nơ-ron tự chơi) | Bỏ: cần hạ tầng huấn luyện, mô hình nặng trong trình duyệt, khó chỉnh và khó giữ tính cách |
| Thêm luật tay vào bot Thường | Chỉ làm phần bổ trợ (cuối ván, nước bắt buộc) |

PIMC vẫn được làm, như **mốc so sánh** trong giả lập: hai cách dùng chung phần đoán bài và giả lập (7.2), nên tốn ít công. **Bản nào thắng nhiều hơn với cùng ngân sách thời gian thì được giữ**; kỳ vọng là ISMCTS.

### 7.2 Phần dùng chung

- **Dựng thế giới từ góc nhìn của mình** (`packages/engine`, hàm mới): nhận `PlayerView` của ghế bot cùng một cách gán các lá ẩn (lá úp của từng đối thủ, thứ tự chồng bài), trả về một `GameState` đầy đủ để giả lập. Hàm chỉ dùng dữ liệu có trong `PlayerView` cộng phần được đoán; bot vẫn không bao giờ đọc state thật. Test bảo đảm: dựng từ view của ghế A rồi lấy lại view của A thì giống hệt view ban đầu; lá đã lật, số lá, số bạc, phase và người đang được hỏi giữ nguyên.
- **Đoán bài theo niềm tin** (`packages/bots`): mỗi lần bốc một thế giới, gán lá ẩn ngẫu nhiên nhưng có trọng số theo mô hình §4 (đếm lá, lời tuyên bố, lời chặn, lần thắng thách đã reset). Tổng số lá từng loại luôn đúng 3. Phần **đọc người chơi** đã có sẵn trong trí nhớ của bot Thường (tỉ lệ bluff bị bắt, `challengeRate`) và được dùng luôn khi đoán bài và khi giả lập đối thủ.
- **Giả lập rẻ**: phần chơi tiếp trong mỗi thế giới dùng bản rút gọn của bot Thường (không softmax tốn kém, không sticker, không thời gian suy nghĩ). **Mỗi người trong giả lập chỉ thấy view của ghế mình** ở thế giới đó, để không ai "nhìn trộm" kể cả trong tưởng tượng.
- **Chấm điểm** khi giả lập dừng (hết ván, hoặc sau tối đa 6 lượt): thắng = 1, bị loại = 0; ván chưa xong thì điểm theo số lá còn úp, số bạc so với ngưỡng đảo chính 7, số đối thủ còn sống.

### 7.3 ISMCTS

- Mỗi vòng lặp: bốc một thế giới (7.2) → đi xuống **một cây chung**, nút là các lượt quyết định theo thứ tự engine đưa ra (hành động, thách, chặn, chọn lá bỏ, đổi bài, chọn lá thay). Ở mỗi nút chỉ xét các nước hợp lệ trong thế giới đang bốc. Chọn nhánh theo UCT có tính số lần nhánh đó khả dụng (*availability count*) → mở một nút mới → giả lập rẻ tới khi dừng → cập nhật điểm ngược lên cây, mỗi nút ghi điểm theo góc nhìn của người ra quyết định ở nút đó.
- Nước của đối thủ trong cây là nước họ có thể làm từ góc nhìn của họ: cây không phân biệt bài thật hay bluff, nên **bluff có tính toán** tự xuất hiện. Xưng một lá mình không có chỉ là một nhánh, được chấm như mọi nhánh khác, kể cả khả năng bị thách theo `challengeRate` của từng người.
- Hết ngân sách thì chọn nước ở gốc được thăm nhiều nhất, có chút ngẫu nhiên (nhiệt độ `τ` = 0,3) để không bị đoán trước.

### 7.4 Tối ưu

- **Tính trong ngân sách thời gian** (*anytime*): mặc định 250 ms, dừng lúc nào cũng có kết quả. Bỏ qua tìm kiếm khi chỉ có một nước hợp lệ hoặc có nước bắt buộc (đủ 10 bạc thì phải đảo chính); khi đó trả lời ngay như bot Thường.
- **Dùng chung thế giới** khi so các nước ở gốc (*common random numbers*), để ít nhiễu và cần ít vòng lặp hơn.
- **Cuối ván:** còn 2 người và tổng số lá úp ≤ 3 thì số thế giới khả dĩ nhỏ: duyệt hết thay vì bốc ngẫu nhiên.
- **Web Worker:** khi chơi với bot, tìm kiếm chạy trong một worker riêng, nên giao diện không khựng. Thời gian tính nằm trong thời gian "suy nghĩ" 0,5–2,5 giây vốn có của bot: người chơi không phải chờ thêm.
- Tính cách (§8) giữ ý nghĩa: `bluffRate` và `aggression` làm lệch nhẹ điểm của các nhánh bluff/thách ở gốc, để các bot Khó vẫn khác nhau.

### 7.5 Đo và nghiệm thu

- Giả lập (`pnpm bots:sim`): Khó vs Thường 1 chọi 1, mục tiêu ≥ 60%; thêm bàn 4 và 6 người (1 Khó + Thường). PIMC và ISMCTS đấu nhau và đấu Thường với cùng ngân sách.
- Đo thời gian mỗi nước (trung bình và p95) trên máy dev; p95 ≤ 300 ms.

### 7.6 Kết quả (checkpoint 29, 2026-11-01)

**Chọn PIMC.** Cùng ngân sách 250 ms mỗi nước:

| Cặp đấu (1 chọi 1, cân bằng) | Số ván | Kết quả |
|---|---|---|
| **PIMC vs Thường** | 350 | **PIMC 64,9%** ✅ (≥ 60%) |
| ISMCTS vs Thường | 200 | ISMCTS 60,5% |
| ISMCTS vs PIMC | 200 | 50,5% / 49,5%: ngang nhau |
| 1 Khó (PIMC) + 3 Thường | 140 | Khó 42,1% (chia đều 25%) |
| 1 Khó (PIMC) + 5 Thường | 98 | Khó 31,6% (chia đều 16,7%) |

PIMC thắng bot Thường nhiều hơn, ngang ISMCTS khi đối đầu, lại đơn giản hơn, nên là bot Khó mặc định. ISMCTS được giữ trong `hard/search.ts` để so sánh (`pnpm bots:sim --bots ismcts,normal`).

**Những điều học được khi làm:**
- **ISMCTS một góc nhìn để đối thủ "thấy" bài thật của bot.** Bản đầu tìm kiếm cả nước của đối thủ trong cùng một cây. Trong mọi thế giới bài của bot là bài thật, nên thống kê ở nút của đối thủ "biết" bot đang bluff hay không. Bot vì thế bluff quá ít và quá sợ đối thủ: thắng PIMC 57% nhưng chỉ thắng Thường 56%. Sửa: cây chỉ chứa quyết định của chính bot; giữa các quyết định đó, đối thủ đi theo chính sách nhanh, chỉ từ bài của họ. Lên 60,5%.
- **Thắng sớm phải đáng giá hơn thắng muộn.** Khi bot đã áp đảo, mọi nước đều dẫn tới thắng trong 6 lượt giả lập, điểm bằng nhau và bot không chịu đảo chính kết thúc ván. Hàm chấm điểm trừ 3% mỗi lượt cho một chiến thắng (tối thiểu 0,75).
- **Lá vừa chứng minh phải gán trước.** Đoán bài theo từng người lần lượt có thể đưa hết các bản còn lại của một nhân vật cho người khác, trước khi tới người vừa chứng minh có nó. Giờ các lá biết chắc được gán trước (có test).
- **Tốc độ quyết định sức mạnh.** `applyInput` sao chép state bằng `structuredClone` (13 µs mỗi nước). Thay bằng `cloneState` viết tay trong engine: 2,2 µs. Mỗi nước 250 ms giờ chạy được 2.000–6.000 vòng (2–6 người), trước đó vài trăm. Server cũng hưởng lợi.

**Thời gian mỗi nước** (6 ván mỗi cỡ bàn, trên máy dev): p50 250 ms, p95 251 ms, tối đa 252 ms ở bàn 2, 4 và 6 người ✅ (≤ 300 ms). Nước chỉ có một lựa chọn trả lời ngay, không tìm kiếm.

**Thay đổi ở engine:**
- `PlayerView` có thêm `pending` (các bước còn lại của lượt). Đây là thông tin công khai: lá trong bước thay lá là lá vừa được xưng công khai (có test).
- `determinize(view, guess, seed)` dựng `GameState` từ một view cộng phần đoán; dựng từ bài thật thì ra đúng state, đoán khác thì view của người xem không đổi (có test trên các ván ngẫu nhiên 2–6 người).
- `cloneState` thay `structuredClone` trong `applyInput`.

### 7.7 Đưa vào game (checkpoint 30, 2026-11-01)

- **Chỉ ở màn chơi với bot:** lựa chọn "Khó" (gợi ý: "Tính trước nhiều nước, khó đọc bài") cạnh Dễ / Thường. Phòng online vẫn chỉ có Dễ / Thường (`BOT_DIFFICULTY_OPTIONS` không đổi), vì bot online chạy trên server.
- **`Match` nhận cách quyết định bất đồng bộ** (`MatchOptions.decide`, kiểu `BotDecider`): có thể trả về Promise. Trong lúc chờ, ghế giữ chỗ cho phase đó. Khi có câu trả lời, `Match` chỉ áp dụng nếu vẫn đúng phase và đúng bot, và trừ thời gian đã nghĩ khỏi thời gian "suy nghĩ" hiển thị. Phase đã qua thì câu trả lời bị bỏ. Server dùng mặc định (quyết định ngay), không đổi gì.
- **Web Worker** (`apps/web/src/game/bot.worker.ts`, `bot-decider.ts`): 2 worker chạy bot Khó, vì nhiều bot thường được hỏi cùng lúc (ai thách, ai chặn); Dễ / Thường vẫn quyết định ngay trên luồng chính. Không tạo được worker, hoặc worker lỗi: bot Khó tính trên luồng chính với ngân sách 60 ms. Offline mà file worker chưa từng được tải (chưa chơi bot Khó lần nào khi có mạng) thì rơi vào trường hợp này: vẫn chơi được.
- Kiểm thử: `match.test.ts` (bot nghĩ bằng Promise chơi hết ván; câu trả lời trễ sau khi phase đã qua không được áp dụng). E2E `local-game.spec.ts`: chọn Khó, chơi hết một ván 3 người, có worker được tạo.

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

Mỗi bot "nhập vai" một nhân vật của theme: avatar là hình nhân vật, tính cách theo bảng dưới (`apps/web/src/game/seats.ts`). **Tên bot là biệt danh riêng** (`botName` trong `theme.json`), không trùng tên lá bài nào. Nếu không, log sẽ ra những câu rối như "Phú Hộ xưng Đệ Tử Cái Bang…".

| Nhân vật (avatar) | Biệt danh bot (Giang Hồ) | Tính cách |
|---|---|---|
| Phú Hộ | Lão Tiền / Old Coin | thận trọng |
| Ảnh Sát Thủ | Tiểu Ảnh / Little Shade | hiếu chiến |
| Đệ Tử Cái Bang | A Cẩu / Scruffy | hay bluff |
| Đạo Sĩ Xem Quẻ | Thanh Phong / Master Breeze | cân bằng |
| Nữ Hiệp Áo Trắng | Bạch Y / Lady White | thù dai |

Mỗi ván, các nhân vật được xáo ngẫu nhiên. Người chơi nhận avatar của nhân vật không bot nào dùng.

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

  Tham số: `--bots` (danh sách độ khó, mỗi mục một ghế; `hard` là PIMC, thêm `ismcts` để so sánh), `--games`, `--personality`, `--seed`, `--time` (ms mỗi nước của bot Khó, mặc định 250).

  | Kết quả hiện tại | Tỉ lệ thắng |
  |---|---|
  | Dễ vs Ngẫu nhiên (2 người, 1.000 ván) | Dễ 72% |
  | 2 Dễ + 2 Ngẫu nhiên (4 người, 500 ván) | Phe Dễ 89% |
  | **Thường vs Dễ** (2 người, 2.000 ván, cân bằng) | **Thường 72%** ✅ mục tiêu ≥ 70% |
  | Thường vs Dễ, tính cách hay bluff / thận trọng / hiếu chiến | 73% / 74% / 69% |
  | 1 Thường + 3 Dễ (4 người, 1.500 ván) | Thường 49% (chia đều: 25%) |
  | 1 Thường + 5 Dễ (6 người, 1.000 ván) | Thường 50% (chia đều: 17%) |
  | **Khó vs Thường** (2 người, 350 ván, 250 ms/nước) | **Khó 64,9%** ✅ mục tiêu ≥ 60% |
  | 1 Khó + 3 Thường / 1 Khó + 5 Thường | Khó 42,1% / 31,6% (chia đều 25% / 17%) |

- **Bot Khó** (checkpoint 29): unit test cho hàm dựng thế giới (view dựng lại trùng view gốc), cho phần đoán bài (đủ 3 lá mỗi loại, không gán lá đã thấy, theo đúng niềm tin), cho các luật cứng (không bao giờ ra input ngoài `legal`, nước bắt buộc trả ngay), và cho ngân sách thời gian. Giả lập Khó vs Thường như §7.5.
- **Phân tích hành vi** khi tinh chỉnh (bot nào bluff bao nhiêu, thách đúng / sai bao nhiêu lần):

  ```bash
  pnpm --filter @chibi-bluff/bots exec tsx src/sim/diagnose.ts normal,easy 1000
  ```
