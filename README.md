# WiFi Drop

Ứng dụng web để các thiết bị cùng Wi-Fi gửi file trực tiếp cho nhau. Chọn WebRTC để truyền trực tiếp giữa các peer hoặc Relay để chuyển dữ liệu qua server. Máy chủ chỉ lưu trạng thái ghép phòng, không ghi file xuống ổ đĩa. Mỗi phòng hỗ trợ tối đa 8 thiết bị. Font DM Sans và Manrope được phục vụ từ các file local trong `public/fonts`, không cần gọi Google Fonts.

## Chạy bằng Docker Compose

Cài Docker Desktop, mở PowerShell tại thư mục project và chạy:

```powershell
docker compose up --build -d
```

Trên máy chạy container, mở `http://localhost:3000`. Thiết bị còn lại mở `http://DIA-CHI-IP-LAN:3000` (ví dụ `http://192.168.1.10:3000`). Tìm IPv4 bằng `ipconfig`. Nếu Windows Firewall hỏi, cho phép Docker Desktop nhận kết nối trên mạng riêng.

Tất cả thiết bị chọn cùng chế độ, nhập cùng mã phòng và bấm **Kết nối**. Chọn **WebRTC trực tiếp** khi các thiết bị liên lạc được với nhau; chọn **Relay qua server** khi LAN/Wi-Fi hoặc subnet bị cách ly. Mỗi thiết bị có thể chọn nhiều file cùng lúc (giữ Ctrl hoặc Shift khi chọn) hoặc kéo thả nhiều file. Bạn cũng có thể nhập/dán text vào ô **Gửi nhanh text hoặc ảnh** rồi gửi; văn bản nhận được hiển thị trên trang và có nút sao chép. Để gửi ảnh, copy ảnh rồi paste vào trang; ảnh sẽ truyền như file và tải xuống ở máy nhận. Ở chế độ WebRTC, file và ảnh truyền trực tiếp giữa các trình duyệt. Ở chế độ Relay, dữ liệu đi qua server theo từng khối và không được ghi xuống ổ đĩa; server sẽ chịu thêm lưu lượng mạng.

Dừng ứng dụng:

```powershell
docker compose down
```

Xem log:

```powershell
docker compose logs -f
```

### Đổi cổng trên máy host

Mặc định app dùng cổng `3000`. Nếu cổng này đã được dùng, đặt biến `PORT` trước khi khởi động, ví dụ:

```powershell
$env:PORT=3001
docker compose up --build -d
```

Sau đó truy cập `http://DIA-CHI-IP-LAN:3001`.

## Chạy không dùng Docker

Yêu cầu Node.js 18 trở lên. Chạy:

```powershell
npm start
```

Dùng địa chỉ LAN do server in ra trong terminal để mở app từ máy khác.

## Ghi chú

- Mỗi phòng hỗ trợ tối đa 8 thiết bị; mọi thiết bị đều có thể gửi và nhận; dừng server hoặc đóng trang sẽ kết thúc phiên.
- Chế độ WebRTC truyền qua DataChannel mã hóa. Relay chuyển nội dung qua server; nếu cần bảo vệ dữ liệu trên đường truyền ngoài mạng tin cậy, hãy triển khai HTTPS/WSS. Các thiết bị cần có đường kết nối tới server; firewall hoặc tính năng cách ly thiết bị của Wi-Fi có thể chặn kết nối.
- Không cần volume vì server không lưu file người dùng.






