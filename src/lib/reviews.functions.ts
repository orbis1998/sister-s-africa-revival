import { createServerFn } from "@tanstack/react-start";
import { fetchApprovedReviews } from "@/lib/reviews";

export const getPublicReviews = createServerFn({ method: "GET" })
  .inputValidator((d: { productSlug?: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    return fetchApprovedReviews({
      productSlug: data.productSlug,
      limit: data.limit,
    });
  });
