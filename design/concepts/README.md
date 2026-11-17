# Concept hình ảnh

Mở file HTML trực tiếp bằng trình duyệt để xem.

| File | Nội dung | Trạng thái |
|---|---|---|
| [giang-ho-preview.html](giang-ho-preview.html) | Theme **Giang Hồ Nhí Nhố** (tên cũ: Giang Hồ Kiếm Hiệp): 5 nhân vật, mặt sau lá bài, tiền tệ, hình nền, sticker | ✅ **Đã chọn.** Đây là nguồn để xuất asset |
| [logo-preview.html](logo-preview.html) | **Logo mascot** kiểu game (như Moonveil, Clash Royale): chibi đeo mặt nạ domino trước quạt bài, vai áo tím, wordmark Baloo 2 có viền; lockup dọc, icon app, favicon, wordmark ngang, thử trên 4 nền | ✅ **Đã chọn** (2026-11-16). Nguồn để xuất `assets/brand/` (icon app, favicon, logo) |
| [chibi-preview.html](chibi-preview.html) | 3 hướng chibi (Tuồng Chibi, Vương Quốc Mèo, Phố Phường) + so sánh 4 font game | Tham khảo. Đã chốt font Baloo 2 từ trang này |
| [style-preview.html](style-preview.html) | "Mặt Nạ Tuồng" sơn mài + so sánh với Neon / Hồ Sơ Mật | ❌ Loại: font không giống game, người dùng muốn chibi |

Xuất asset sau khi sửa `giang-ho-preview.html`:

```bash
node scripts/export-giang-ho-assets.mjs
```

Xuất logo và icon sau khi sửa `logo-preview.html` (SVG vào `assets/brand/`, rồi PNG/ICO cho PWA):

```bash
pnpm export:logo && pnpm export:icons
```

## Các bộ chủ đề đã đề xuất

| Chủ đề | Duke | Assassin | Captain | Ambassador | Contessa |
|---|---|---|---|---|---|
| Tuồng Chibi | Quan Thượng Thư | Thích Khách | Tướng Quân | Sứ Thần | Hoàng Hậu |
| Vương Quốc Mèo | Mèo Thần Tài | Quạ Ninja | Gấu Mèo Hải Tặc | Cú Đưa Thư | Thiên Nga Nữ Hoàng |
| Truyền Thuyết Việt | Thần Tài | Hồ Ly Tinh | Chú Cuội | Nguyệt Lão | Mẹ Âu Cơ |
| **Giang Hồ Nhí Nhố** ✅ | Phú Hộ | Ảnh Sát Thủ | Đệ Tử Cái Bang | Đạo Sĩ Xem Quẻ | Nữ Hiệp Áo Trắng |
| Thủy Cung | Long Vương | Cá Nóc Độc | Bạch Tuộc Móc Túi | Rùa Vàng Đưa Thư | Nàng Tiên Cá |
| Tạp Hóa Tí Hon | Heo Đất | Ớt Hiểm | Kẹo Kéo | Trà Sữa Lắc Lắc | Mít Gai |
| Lớp Học Nhốn Nháo | Lớp Trưởng Thu Quỹ | Thầy Giám Thị | Bạn Cùng Bàn Mượn Không Trả | Dân Sưu Tầm Thẻ | Cô Chủ Nhiệm |
| Vùng Đất Phép Thuật | Vua Lùn Mỏ Vàng | Elf Bóng Đêm | Goblin Cướp Biển | Pháp Sư Dịch Chuyển | Nữ Tu Ánh Sáng |
| Kỷ Nguyên Robot | AI Ngân Hàng | Drone Sát Thủ | Mèo Hacker | Robot Phiên Dịch | Android Hộ Vệ |
| Phố Phường | Bà Chủ Tiệm Vàng | Shipper Bóng Đêm | Chị Đòi Nợ | Cò Đất | Hotgirl Phố Cổ |

*Phố Phường không được khuyến nghị: khó hiểu với người chơi quốc tế, và một số vai dễ bị xem là chế giễu một nhóm người thật.*
