# WiFi Drop

Ứng dụng web để gửi file trực tiếp giữa hai thiết bị cùng mạng Wi-Fi. Máy chủ chỉ phục vụ giao diện và ghép nối thiết bị; nội dung file đi trực tiếp qua WebRTC DataChannel.

## Chạy bằng Docker Compose

Cài Docker Desktop, mở PowerShell tại thư mục project và chạy:

```powershell
docker compose up --build -d
```

Trên máy chạy container, mở `http://localhost:3000`. Thiết bị còn lại mở `http://DIA-CHI-IP-LAN:3000` (ví dụ `http://192.168.1.10:3000`). Tìm IPv4 bằng `ipconfig`. Nếu Windows Firewall hỏi, cho phép Docker Desktop nhận kết nối trên mạng riêng.

Hai máy nhập cùng mã phòng rồi bấm **Kết nối**. Khi đã kết nối, chọn nhiều file cùng lúc (giữ Ctrl hoặc Shift khi chọn) hoặc kéo thả nhiều file. Bạn cũng có thể nhập/dán text vào ô **Gửi nhanh text hoặc ảnh** rồi gửi; văn bản nhận được hiển thị trên trang và có nút sao chép. Để gửi ảnh, copy ảnh rồi paste vào trang; ảnh sẽ truyền như file và tải xuống ở máy nhận. File và ảnh được truyền trực tiếp giữa hai trình duyệt, không lưu trong container.

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

- Mỗi phòng hỗ trợ tối đa hai thiết bị; dừng server hoặc đóng trang sẽ kết thúc phiên.
- Dữ liệu truyền qua kết nối WebRTC mã hóa. Cả hai thiết bị cần cùng mạng có thể giao tiếp với nhau; firewall hoặc tính năng cách ly thiết bị của Wi-Fi có thể chặn kết nối.
- Không cần volume vì server không lưu file người dùng.


