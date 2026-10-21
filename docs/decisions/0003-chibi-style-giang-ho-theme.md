# 0003 · Phong cách chibi, font Baloo 2, theme đầu tiên "Giang Hồ Kiếm Hiệp"

- **Ngày:** 2026-10-20
- **Trạng thái:** Chấp nhận

## Bối cảnh

Đã thử 3 vòng concept (xem [design/concepts/README.md](../../design/concepts/README.md)):
1. "Mặt Nạ Tuồng" sơn mài, font có chân Playfair Display. **Bị loại:** font không giống game; người dùng muốn phong cách chibi.
2. Ba hướng chibi (Tuồng Chibi, Vương Quốc Mèo, Phố Phường) và bốn font game. **Chốt:** font Baloo 2; người dùng muốn có thêm lựa chọn về thân phận nhân vật.
3. Chín bộ chủ đề. **Chọn:** Giang Hồ Kiếm Hiệp.

## Quyết định

- Phong cách: **chibi phẳng, viền đậm**, nền tím than.
- Font: **Baloo 2** cho toàn bộ giao diện.
- **Hệ thống theme:** tên, hình, màu, sticker và tiền tệ của nhân vật là dữ liệu (`theme.json`), không phải code. Theme đầu tiên là **Giang Hồ Kiếm Hiệp** (sau đổi tên thành **Giang Hồ Nhí Nhố**, xem [0004](0004-name-mvp-mobile-public.md)); tiền tệ là "lượng bạc".

## Hệ quả

- Thêm theme mới chỉ cần thêm asset và manifest, không đụng engine.
- Chữ trên lá bài do app vẽ (để đổi theo ngôn ngữ); file SVG nhân vật không chứa chữ.
- Asset hiện tại là vector vẽ bằng code. Có thể thay bằng tranh của họa sĩ, miễn giữ đúng quy ước ở [ui-design.md §8.2](../ui-design.md).
