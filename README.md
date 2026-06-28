# ShopSmart AI

ShopSmart AI is a conversational AI shopping assistant that helps users plan events and DIY projects by recommending the right products instantly.

## Live Demo
🔗 [https://shopsmart-ai-build.vercel.app](https://shopsmart-ai-build.vercel.app)

## Built With
- **Next.js** — Frontend framework
- **AWS DynamoDB** — Product catalog database
- **Vercel** — Deployment and AI Gateway
- **Vercel AI SDK** — Streaming chat with tool calls
- **GPT-4o-mini** — AI recommendations
- **TypeScript / Tailwind CSS / pnpm**

## Features
- Event planning assistant (birthday parties, BBQs, movie nights)
- DIY project assistant (plumbing, electrical, painting, carpentry)
- AI-powered product recommendations from real catalog
- DynamoDB-first caching — faster responses over time

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

## Environment Variables
VERCEL_OIDC_TOKEN=
DYNAMODB_TABLE_NAME=
AWS_REGION=
AWS_ROLE_ARN=
AWS_RESOURCE_ARN=
AWS_ACCOUNT_ID=
AI_GATEWAY_API_KEY=

## Hackathon Submission
Built for the [H01 AWS + Vercel Hackathon](https://h01.devpost.com) — June 2026.

## License
See [LICENSE](./LICENSE)
