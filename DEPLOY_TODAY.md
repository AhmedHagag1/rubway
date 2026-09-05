# RUBWAY — نشر النسخة الأولى

## قبل النشر

- المستودع يجب أن يظل خاصًا أثناء الاختبار التشغيلي.
- لا ترفع ملفات `.env` أو كلمات مرور أو tokens أو مفاتيح توقيع.
- استخدم `.env.example` كمرجع لأسماء المتغيرات فقط.

## Render — Backend + PostgreSQL

1. من Render اختر **New > Blueprint**.
2. اختر مستودع GitHub الخاص بالمشروع.
3. Render سيقرأ `render.yaml` وينشئ PostgreSQL وخدمة FastAPI.
4. `DATABASE_URL` و`JWT_SECRET_KEY` يتم تجهيزهما من الـBlueprint.
5. اضبط يدويًا القيم السرية/الخاصة التالية عند الحاجة:
   - `ADMIN_PASSWORD_HASH`
   - `FRONTEND_URL`
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
   - `TELEGRAM_WEBHOOK_SECRET`
   - `BACKEND_PUBLIC_URL`
6. لا تضع كلمة مرور الإدارة كنص عادي؛ استخدم hash متوافقًا مع backend.

## Vercel — Frontend

1. Import Project من GitHub.
2. Root Directory = `frontend`.
3. أضف Environment Variable:

```text
NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL.onrender.com/api/v1
```

4. Deploy.
5. ارجع إلى Render واضبط `FRONTEND_URL` على رابط Vercel بدون `/` في النهاية، ثم Redeploy.

## Telegram

إذا كنت ستستخدم تحكم Telegram، راجع `TELEGRAM_ADMIN_SETUP.md` واضبط `BACKEND_PUBLIC_URL` و`TELEGRAM_WEBHOOK_SECRET` إلى قيم الإنتاج.

## تنبيه الإيصالات

التخزين المحلي على Render قد يكون غير دائم بحسب الخطة. قبل استقبال معاملات حقيقية يجب نقل الإيصالات إلى تخزين دائم مثل S3-compatible storage أو خدمة مماثلة.

## قبل أي استخدام حقيقي

المشروع حاليًا prototype تقني، وليس بنية دفع production-ready. أي تشغيل بأموال حقيقية يحتاج مراجعة قانونية/امتثال، logging ومراقبة، نسخ احتياطي، تخزين ملفات دائم، اختبارات أمنية واختبارات استعادة للأخطاء.
