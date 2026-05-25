import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton genérico pra páginas server-rendered. Usado em loading.tsx
 * de rotas que ainda não têm skeleton customizado. Mostra header + N cards.
 */
export function PageSkeleton({
  cards = 3,
  cardHeight = "h-44",
}: {
  cards?: number;
  cardHeight?: string;
}) {
  return (
    <>
      <div className="mb-6">
        <Skeleton className="h-4 w-40 mb-2" />
        <Skeleton className="h-9 w-72 mb-3" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className={cardHeight} />
        ))}
      </div>
    </>
  );
}
