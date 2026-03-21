# Tech Stack Overview: Wallet App

This document provides a detailed overview of the technologies, frameworks, and libraries used to build the Wallet App.

## Core Framework
- **[Next.js](https://nextjs.org/) (v16.2.1):** The overarching React framework used for server-side rendering, routing (via the App Router `src/app/`), and overall application architecture.
- **[React](https://react.dev/) (v18.3.1):** The foundational UI library used for building interactive components.
- **[TypeScript](https://www.typescriptlang.org/) (v5+):** Used exclusively throughout the project for strong static typing to ensure code reliability and maintainability.

## Styling & UI Components
- **[Tailwind CSS](https://tailwindcss.com/) (v4):** Used for utility-first styling and rapid UI development. Integrated with PostCSS (`@tailwindcss/postcss`).
- **[shadcn/ui](https://ui.shadcn.com/):** A collection of re-usable components built on top of Tailwind CSS. Included via `shadcn` CLI.
- **[Base UI](https://mui.com/base-ui/) & Radix Primitives:** Headless, accessible UI components.
- **cmdK (`cmdk`):** A fast, unstyled command menu React component, used for the Command Palette interface.
- **[Lucide React](https://lucide.dev/):** Used for standardized, clean SVG icons (`lucide-react`).
- **React Day Picker:** Used for flexible date selection interfaces (`react-day-picker`).
- **Styling Utilities:** `clsx` and `tailwind-merge` safely conditionally merge Tailwind classes without style conflicts, while `tw-animate-css` adds animation support.

## Data Processing & Utilities
- **Excel Handling:** [`xlsx`](https://sheetjs.com/) (v0.18.5) is used to parse, generate, and interact with Excel spreadsheet data.
- **Date Utilities:** `date-fns` (v4.1.0) provides a modern, comprehensive toolset for manipulating JavaScript dates.
- **Identifiers:** `uuid` is utilized for generating unique identifiers across the application.

## Artificial Intelligence
- **Google Generative AI:** The `@google/generative-ai` SDK connects the application to Google's Gemini models for AI insights and chat assistance functionalities (`ChatAssistant.tsx`, `AiInsightsCard.tsx`).

## Global State & Internationalization
- **Context API:** React Context is utilized for application-level state management (`AppContext.tsx`).
- **Custom i18n:** Built-in lightweight internationalization utilizing `en.json` and `my.json` via a configuration layer (`i18n/config.ts`).

## Development & Build Tools
- **ESLint (v9):** Configured with Next.js specific rules for code quality and standardization (`eslint.config.mjs`).
- **TypeScript Compiler:** Ensures type-safety before builds process (`tsconfig.json`).

## DevOps & Deployment
- **Docker:** Containerization of the Next.js app is handled natively using `Dockerfile` and `docker-compose.yml`.
- **Kubernetes (K8s):** A deployment strategy is predefined for scaling via `k8s/deployment.yaml`.
