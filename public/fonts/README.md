# Lao font — Phetsarath OT

วาง 2 ไฟล์นี้ในโฟลเดอร์นี้:

- `Phetsarath-Regular.ttf` (น้ำหนัก 400)
- `Phetsarath-Bold.ttf` (น้ำหนัก 700)

## ดาวน์โหลด

Phetsarath OT เป็นฟอนต์ open source (SIL Open Font License) จากกระทรวง ICT ลาว

**แหล่งดาวน์โหลด:**

1. **GitHub mirror** (เร็วที่สุด):
   https://github.com/silnrsi/font-phetsarath

   ไฟล์อยู่ใน `web/` หรือ `assets/` หลังจาก clone — ต้อง rename เป็น `Phetsarath-Regular.ttf` / `Phetsarath-Bold.ttf`

2. **SIL official**:
   https://software.sil.org/phetsarath/

3. **Google Fonts ไม่มี** — Phetsarath ยังไม่ถูกนำเข้า Google Fonts ดังนั้นต้องโหลดเอง

## หลังวางไฟล์

ระบบทำงานทันที — ไม่ต้องแก้โค้ดเพิ่ม Browser จะเลือกใช้ Phetsarath OT สำหรับตัวอักษรลาวอัตโนมัติ
(Latin → Inter, ไทย → Sarabun, ลาว → Phetsarath)

ถ้าไม่ได้วางไฟล์ → ตัวอักษรลาวจะใช้ system font (Tahoma/Noto Sans Lao บางเครื่อง) แทน — ระบบไม่พัง
