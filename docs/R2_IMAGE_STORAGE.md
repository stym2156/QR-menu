# Cloudflare R2 image storage

Use R2 for menu, promotion, and payment QR images in production. Supabase still stores the database rows; only the image files move to R2.

## Cloudflare

1. Create one R2 bucket, for example `shopqr-images`.
2. Create an R2 API token with Object Read/Write access for that bucket.
3. Add a public/custom domain for the bucket, for example `cdn.yourdomain.com`.
4. Point `cdn.yourdomain.com` through Cloudflare DNS.

## Vercel environment variables

Set these values in Vercel for Production and Preview:

```env
NEXT_PUBLIC_IMAGE_STORAGE_DRIVER=r2
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=shopqr-images
R2_PUBLIC_BASE_URL=https://cdn.yourdomain.com
```

Keep Supabase variables as-is. If `NEXT_PUBLIC_IMAGE_STORAGE_DRIVER` is not `r2`, the app falls back to Supabase Storage.

## Object paths

The app writes to one R2 bucket with separate prefixes:

- `menu/{restaurantId}/...`
- `promotions/{restaurantId}/...`
- `payment-qr/{restaurantId}/...`

The database stores the final public URL in `image_url` or `payment_qr_url`.
