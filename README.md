# ShopQR

ระบบ QR Ordering สำหรับร้านอาหาร — เจ้าของร้านสร้าง QR ที่โต๊ะ ลูกค้าสแกนเพื่อสั่งอาหาร ครัวเห็น order แบบ realtime

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind · Supabase (Auth + Postgres + Storage + Realtime)**

---

## โครงสร้างโปรเจกต์

```
src/
├── app/
│   ├── page.tsx                              landing
│   ├── login/                                เข้าสู่ระบบ
│   ├── signup/                               สมัคร + สร้างร้าน
│   ├── dashboard/                            (auth required)
│   │   ├── page.tsx                          overview
│   │   ├── menu/                             จัดการเมนู + อัปโหลดรูป
│   │   ├── tables/                           สร้างโต๊ะ + ดาวน์โหลด QR PNG
│   │   └── kitchen/                          realtime kitchen display
│   └── menu/[restaurantId]/[tableId]/        ลูกค้าสั่งอาหาร (ไม่ต้อง login)
├── lib/supabase/                             browser + server + middleware clients
└── lib/types.ts                              shared TypeScript types
supabase/migrations/0001_init.sql             schema + RLS + storage
middleware.ts                                 auth guard
```

---

## ตั้งค่าครั้งแรก

### 1. สร้าง Supabase project

1. ไปที่ <https://supabase.com> → New project
2. รอ project ขึ้น (~2 นาที)
3. Copy **Project URL** และ **anon public key** จาก **Settings → API**

### 2. รัน SQL migration

เปิด **SQL Editor** ใน Supabase Dashboard แล้วรันตามลำดับ:

1. `supabase/migrations/0001_init.sql` — core tables, RLS, storage, trigger สร้างร้าน
2. `supabase/migrations/0002_features.sql` — categories, payment, call-staff

จะสร้าง:
- ตาราง `restaurants`, `tables`, `menus`, `orders`, `categories`, `call_staff_requests`
- enum `order_status` (`pending` / `ready` / `served`)
- RLS policies (เจ้าของเห็นเฉพาะข้อมูลร้านตัวเอง / ลูกค้า anon สั่งและเรียกพนักงานได้)
- Storage bucket `menu-images` (public read)
- เปิด Realtime บน `orders` และ `call_staff_requests`
- Trigger สร้างร้านอัตโนมัติเมื่อ user signup

### 3. ใส่ env

```bash
cp .env.example .env.local
```

แก้ `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
```

### 4. รันโปรเจกต์

```bash
npm install
npm run dev
```

เปิด <http://localhost:3000>

---

## วิธีใช้งาน

1. **สมัครสมาชิก** ที่ `/signup` — ใส่ชื่อร้าน + อีเมล + รหัสผ่าน
2. **สร้างหมวดหมู่** ที่ `/dashboard/categories` — เช่น อาหาร / เครื่องดื่ม / ของหวาน
3. **เพิ่มเมนู** ที่ `/dashboard/menu` — อัปโหลดรูป, ตั้งชื่อ, ราคา, เลือกหมวด
4. **สร้างโต๊ะ + QR** ที่ `/dashboard/tables` — กด **ดาวน์โหลด PNG** เพื่อพิมพ์
5. **ลูกค้าสแกน QR** → เข้าสู่หน้า `/menu/:restaurantId/:tableId` (ไม่ต้อง login)
   - สั่งอาหาร พร้อมเพิ่มหมายเหตุต่อรายการ (เผ็ดน้อย/ไม่ใส่ผัก)
   - กดปุ่ม **🧾 ดูบิล** เพื่อตรวจรายการที่สั่ง
   - กดปุ่ม **🔔 เรียกพนักงาน** พร้อมเลือกเหตุผล
6. **ครัวดูออเดอร์** ที่ `/dashboard/kitchen` — realtime + เสียงแจ้งเตือน
   - คลิกเปิดเสียงแจ้งเตือนครั้งแรกเข้าหน้านี้
   - กดทำเสร็จ → พร้อมเสิร์ฟ → ชำระเงิน (เลือกวิธี) → เสิร์ฟแล้ว
   - ยกเลิกออเดอร์ได้
   - เห็น banner ลูกค้าเรียกพนักงาน
7. **ดูสถิติ** ที่ `/dashboard/stats` — ยอดวันนี้ / 7 วัน / 30 วัน + กราฟ + เมนูขายดี

---

## หมายเหตุการ Deploy

- **Vercel** ใช้ได้ทันที — เพิ่ม env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` ใน project settings
- **Supabase Auth** อาจต้อง disable email confirmation ใน **Authentication → Providers → Email** ตอนทดสอบ (ไม่งั้นต้องคลิกลิงก์ในเมล)
- **CORS / Site URL** ตั้งใน **Authentication → URL Configuration** ให้ตรงกับ production domain

---

## สถาปัตยกรรม (data flow)

| Flow | ตำแหน่ง |
|---|---|
| Signup | `signUp({options.data.restaurant_name})` → trigger สร้าง `restaurants` row อัตโนมัติ |
| Auth guard | `middleware.ts` → redirect `/dashboard/*` ถ้าไม่มี session |
| Categories | owner CRUD ที่ `/dashboard/categories`, ใช้เป็น group ในหน้าลูกค้า |
| Menu insert | upload → `storage.menu-images` → `from('menus').insert({category_id})` |
| QR generation | `qrcode.toDataURL()` ฝั่ง client → download PNG |
| Customer order | anon insert ลง `orders` พร้อม `items[{menu_id, qty, note?}]` |
| Bill view | anon select `orders where paid=false and table_id=X` |
| Call staff | anon insert ลง `call_staff_requests` |
| Realtime | `channel(kitchen)` subscribe `orders` + `call_staff_requests` ทุก event |
| Sound alert | Web Audio API (src/lib/sound.ts) — ปลดล็อกด้วยปุ่มแรก |
| Payment | owner update `paid=true, paid_at, payment_method` |
| Stats | server-side query `paid=true` orders ใน 30 วัน → group ฝั่ง client |

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev         # local dev (http://localhost:3000)
npm run build       # production build
npm run start       # serve production build
npm run typecheck   # ตรวจ TypeScript
npm run lint        # ESLint
```
