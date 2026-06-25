# Surplusly

Surplusly is an MVP food rescue marketplace that helps restaurants list discounted surplus food for nearby customers. If food is not claimed in time, the workflow can move it into rescue mode so volunteers and NGO partners can help redirect it instead of letting it go to waste.

Live demo: [https://surplusly-48f38.web.app](https://surplusly-48f38.web.app)

## Why Surplusly

Restaurants often prepare more food than they sell, especially near closing time. Surplusly turns that surplus into a real-time pickup opportunity: customers can discover discounted meals nearby, while unclaimed food can be routed toward volunteers and community organizations.

## MVP Features

- Customer discovery page with list-first restaurant browsing, search, filters, deal cards, and reservation flow.
- Restaurant dashboard for posting surplus listings, managing pickup locations, viewing active listings, and triggering rescue mode for demos.
- QR-based confirmation flow for reservations, restaurant handoff, volunteer pickup, and NGO receipt.
- Volunteer dashboard for rescue tasks with pickup/drop-off workflow.
- NGO dashboard for incoming deliveries and receipt confirmation.
- Firebase-backed authentication, Firestore data, rules, and Firebase Hosting deployment.

## Core Flow

1. Restaurants post surplus food with quantity, price, tags, and pickup deadline.
2. Customers browse nearby discounted food and reserve a listing.
3. The customer receives a QR code for pickup confirmation.
4. If food is not claimed, the listing can move into rescue mode.
5. Volunteers pick up from the restaurant and deliver to an NGO or shelter.
6. The final drop-off is confirmed with QR validation.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS
- Backend: Firebase Auth and Firestore
- Hosting: Firebase Hosting
- UI/UX: Lucide icons, responsive marketplace-style layouts

## Local Setup

Install dependencies:

```bash
pnpm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in `.env` with your Firebase web app config:

```bash
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

Run the app locally:

```bash
pnpm run dev
```

Default local URL:

```bash
http://localhost:5173
```

This workspace has also been run on:

```bash
http://localhost:4173
```

## Useful Commands

Type-check the app:

```bash
pnpm run check
```

Build for production:

```bash
pnpm run build
```

Preview the production build locally:

```bash
pnpm run preview
```

Deploy Firestore rules/indexes:

```bash
pnpm run firebase:deploy
```

Deploy Firebase Hosting:

```bash
npx -y firebase-tools deploy --only hosting --project surplusly-48f38
```

## Firebase Hosting

The app is configured to deploy the Vite build output from `dist/`. Firebase Hosting rewrites all routes to `index.html`, so direct links like `/customer/browse` and `/restaurant/dashboard` work correctly.

## Project Status

Surplusly is currently an MVP demo focused on one-city or campus-style usage. Payments, production-grade scheduling jobs, production notifications, and full operational rescue logistics are future enhancements.

## Future Improvements

- Automated scheduled escalation from live listings into rescue mode.
- Push notifications for customers, volunteers, restaurants, and NGOs.
- Dynamic pricing as pickup deadlines approach.
- Photo proof uploads for pickup and delivery.
- Trust scores and volunteer leaderboards.
- More complete admin analytics for meals saved, food rescued, and estimated environmental impact.
