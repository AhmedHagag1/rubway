# RUBWAY — نشر النسخة الأولى

## GitHub
ارفع مجلد RUBWAY بالكامل إلى مستودع GitHub خاص. لا ترفع ملفات `.env`.

## Render
1. New > Blueprint.
2. اختر مستودع GitHub.
3. Render سيقرأ `render.yaml` وينشئ PostgreSQL وBackend.
4. أضف `ADMIN_PASSWORD_HASH` و`FRONTEND_URL` بعد إنشاء رابط Vercel.

## Vercel
1. Import Project من GitHub.
2. Root Directory = `frontend`.
3. Environment Variable:
   `NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL.onrender.com/api/v1`
4. Deploy.
5. ارجع إلى Render واضبط `FRONTEND_URL` على رابط Vercel بدون `/` في النهاية، ثم Redeploy.

## تنبيه الإيصالات
التخزين المحلي على Render قد لا يكون دائمًا على الخطة المجانية. النسخة الأولى تعمل، لكن قبل استقبال معاملات حقيقية يجب ربط Cloudinary أو S3-compatible storage.
