# 0005 · Ngôn ngữ nằm trong URL, link không có ngôn ngữ được tự chuyển hướng

- **Ngày:** 2026-10-24
- **Trạng thái:** Chấp nhận (thay cho đề xuất "ngôn ngữ trong cookie, URL không có tiền tố" ở checkpoint 6)

## Bối cảnh

Ban đầu dự định lưu ngôn ngữ trong cookie và dùng next-intl, để URL gọn (`/play/local`) và link mời vào phòng mở đúng ngôn ngữ của từng người.

Khi dựng app thì gặp mấy điểm:
- Next.js 16.4 bật sẵn **Cache Components**. Đọc cookie ở root layout sẽ buộc mọi trang phải render động, phải bọc Suspense, và dễ bị nhấp nháy hoặc lỗi hydration khi chữ đổi ngôn ngữ sau khi tải.
- Hướng dẫn i18n chính thức của Next 16.4 dùng segment `app/[lang]`, `generateStaticParams` và `next/root-params`, cho phép **render tĩnh** từng ngôn ngữ.
- Chưa rõ next-intl đã hỗ trợ ổn định Next 16.4 khi bật Cache Components hay chưa.

## Quyết định

1. **Mọi trang nằm dưới `/[lang]`** (`/vi/...`, `/en/...`) và được render tĩnh cho từng ngôn ngữ.
2. **`proxy.ts`** bắt các URL không có ngôn ngữ, VD link mời `/room/ABCDE`, rồi chuyển sang `/<ngôn ngữ>/room/ABCDE`. Thứ tự chọn ngôn ngữ:
   1. Cookie `locale`: lựa chọn trước đó của người dùng.
   2. Header `Accept-Language` của trình duyệt.
   3. Mặc định: `vi`.
3. Nút **VI / EN** đổi tiền tố URL và ghi cookie `locale`.
4. **Không dùng next-intl.** Từ điển là file JSON (`apps/web/src/i18n/dictionaries/`). Server đọc bằng `getDictionary()`; client component đọc qua `<I18nProvider>` / `useI18n()`. `vi.json` là bản gốc; TypeScript bắt lỗi nếu `en.json` thiếu khóa.

## Hệ quả

- **Tốt:** trang tĩnh, nhanh, không nhấp nháy, đúng hướng dẫn chính thức. Link mời vẫn ngắn và vẫn mở đúng ngôn ngữ của người nhận.
- **Chưa tốt:** URL dài thêm 3 ký tự. Phải tự viết phần dịch, chưa có định dạng số nhiều hay biến nội suy (thêm khi cần).
- **Ghi chú kỹ thuật:**
  - `dynamicParams` không dùng được khi bật Cache Components. Mã ngôn ngữ lạ trong URL được xử lý bằng `notFound()` trong layout.
  - `app/favicon.ico` phải tồn tại, nếu không `/favicon.ico` sẽ rơi vào route `[lang]`.
  - Route bắt mọi đường dẫn `[lang]/[...rest]` đặt `instant = false` vì luôn trả 404.
