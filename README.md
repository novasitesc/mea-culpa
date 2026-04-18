This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## PayPal (Sandbox)

Para habilitar la nueva integracion de pagos en ruleta USD y desbloqueo de slots de personaje, configura estas variables en `.env.local`:

```bash
NEXT_PUBLIC_PAYPAL_CLIENT_ID=tu_client_id_sandbox
PAYPAL_CLIENT_ID=tu_client_id_sandbox
PAYPAL_CLIENT_SECRET=tu_client_secret_sandbox
PAYPAL_WEBHOOK_ID=tu_webhook_id_sandbox
PAYPAL_ENV=sandbox
```

Notas:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID` se usa en frontend para renderizar los botones de PayPal.
- `PAYPAL_CLIENT_ID` y `PAYPAL_CLIENT_SECRET` se usan en backend para crear/capturar ordenes.
- `PAYPAL_WEBHOOK_ID` es obligatorio para validacion criptografica del webhook.
- El endpoint de webhook es `POST /api/paypal/webhook`.
