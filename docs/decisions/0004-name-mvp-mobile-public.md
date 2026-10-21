# 0004 · Tên "Chibi Bluff", phạm vi MVP, ưu tiên mobile, repo public

- **Ngày:** 2026-10-21
- **Trạng thái:** Chấp nhận

## Bối cảnh

Trước khi bắt đầu code cần chốt những điều ảnh hưởng đến tên package, bố cục giao diện và cách quản lý repo. "Coup" là tên thương mại của nhà phát hành board game gốc, trong khi dự án sẽ được public.

## Quyết định

1. **Tên game:** **Chibi Bluff**. Bộ chủ đề đầu tiên đổi tên thành **Giang Hồ Nhí Nhố** (EN: *Wacky Wuxia*), id vẫn là `giang-ho`. Tiêu đề khi ra mắt: "Chibi Bluff: Giang Hồ Nhí Nhố".
   - Không dùng chữ "Coup" trong tên, logo hay asset. Mặt sau lá bài in "BLUFF".
   - Tài liệu và README ghi rõ game dựa trên **cơ chế** của *Coup* (Rikki Tahta) và không liên kết với nhà phát hành.
   - Tên hành động "Coup" (đảo chính, 7 lượng) vẫn là định danh trong code. Tên hiển thị sẽ đặt khi viết i18n.
2. **MVP:** như [architecture.md §1.1](../architecture.md): bot Dễ và Thường, phòng online, kết hợp, sticker, song ngữ, 1 theme.
3. **Ưu tiên mobile:** thiết kế cho điện thoại dọc trước ([ui-design.md §4](../ui-design.md)); desktop hoàn chỉnh để sau MVP.
4. **Repo public:** không commit secret, cấu hình qua biến môi trường. **Không có file LICENSE**: tác giả giữ mọi quyền với code và hình ảnh.

## Hệ quả

- Package scope: `@chibi-bluff/*`; tên app trên Vercel và Fly: `chibi-bluff`.
- Thanh hành động trên mobile là lưới 4×2, khung phản ứng là bottom sheet.
- Không có LICENSE nghĩa là "giữ mọi quyền": người khác xem được code nhưng không được phép dùng lại, sửa hay phân phối. Muốn nhận đóng góp từ người ngoài thì cần xem lại quyết định này.
