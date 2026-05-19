import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-10 px-6 py-16 text-center">
      <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-ink">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink text-xs font-bold text-surface">
          S
        </span>
        ShopQR
      </div>

      <div className="space-y-4">
        <h1 className="text-5xl font-semibold tracking-tightest text-ink sm:text-6xl">
          QR Ordering
          <br />
          ที่ร้านอาหารคุณ
        </h1>
        <p className="mx-auto max-w-xl text-base text-muted sm:text-lg">
          ลูกค้าสแกน QR ที่โต๊ะ สั่งจากเมนูได้เลย ครัวเห็น order แบบ realtime
          พนักงานเช็คบิลรวมทั้งโต๊ะในคลิกเดียว
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/signup" className={buttonPrimary}>
          เปิดร้านใหม่ฟรี →
        </Link>
        <Link href="/login" className={buttonSecondary}>
          เข้าสู่ระบบ
        </Link>
      </div>

      <p className="text-xs text-muted">
        ใช้งานได้ทันที ไม่ต้องผูกบัตรเครดิต
      </p>
    </main>
  );
}
