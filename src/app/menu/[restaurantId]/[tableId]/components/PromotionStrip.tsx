"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useT } from "@/lib/i18n/I18nProvider";
import type { Promotion } from "@/lib/types";

interface PromotionStripProps {
  promotions: Promotion[];
}

export function PromotionStrip({ promotions }: PromotionStripProps) {
  const { t } = useT();
  const ref = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  function getCardWidth(): number {
    const el = ref.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return 0;
    return card.offsetWidth + 12; // gap-3 = 12px
  }

  function onScroll(): void {
    const el = ref.current;
    if (!el) return;
    const cardWidth = getCardWidth();
    if (cardWidth === 0) return;
    const idx = Math.round(el.scrollLeft / cardWidth);
    setActiveIdx(Math.max(0, Math.min(promotions.length - 1, idx)));
  }

  function scrollTo(idx: number): void {
    const el = ref.current;
    if (!el) return;
    const cardWidth = getCardWidth();
    if (cardWidth === 0) return;
    el.scrollTo({ left: cardWidth * idx, behavior: "smooth" });
  }

  return (
    <div className="border-b border-line bg-surface py-4">
      <div
        ref={ref}
        onScroll={onScroll}
        className="no-scrollbar flex gap-3 overflow-x-auto px-5 snap-x snap-mandatory"
      >
        {promotions.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} />
        ))}
      </div>

      {promotions.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {promotions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={`h-1.5 rounded-full transition-all ${
                idx === activeIdx
                  ? "w-6 bg-ink"
                  : "w-1.5 bg-line hover:bg-muted"
              }`}
              aria-label={t("promo.strip.aria_n", { n: idx + 1 })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PromotionCard({ promotion }: { promotion: Promotion }) {
  const { t } = useT();
  const hasImage = !!promotion.image_url;
  return (
    <div className="flex w-[85%] shrink-0 snap-start flex-col overflow-hidden rounded-2xl bg-ink text-surface shadow-card sm:w-[60%] lg:w-[40%]">
      <div className="relative aspect-[5/3] w-full overflow-hidden bg-zinc-900">
        {hasImage && promotion.image_url ? (
          <Image
            src={promotion.image_url}
            alt={promotion.title}
            fill
            sizes="(min-width: 1024px) 40vw, (min-width: 640px) 60vw, 85vw"
            className="object-contain"
          />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-ink to-zinc-700" />
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="absolute inset-0 flex items-center justify-center text-5xl text-amber-300/40">
              ✦
            </div>
          </>
        )}
      </div>

      <div className="flex min-h-[5.5rem] flex-col justify-center px-4 py-3">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-amber-300">
          <span>✦</span>
          <span>{t("promo.strip.label")}</span>
        </div>
        <div className="mt-1 line-clamp-2 text-base font-semibold leading-snug tracking-tight">
          {promotion.title}
        </div>
        {promotion.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-zinc-200">
            {promotion.description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
