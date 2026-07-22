# PharmaFlow User Mobile App

Production implementation specification for the customer-facing React Native application.

## 1. Product Scope

The application allows customers to:

- Register and authenticate with email, phone, password, and OTP
- Search medicines by name, generic name, brand, category, or strength
- Discover verified nearby pharmacies
- Upload prescription images and PDF documents
- Add medicines to an order
- Select delivery or pharmacy pickup
- Pay using cash on delivery, card, or wallet
- Track pharmacy confirmation and order preparation
- Track a delivery partner in real time
- Chat with the pharmacy or assigned driver
- Manage addresses, notifications, reviews, and previous orders
- Reorder delivered medicines

The app must never assume pharmacy inventory is accurate. Every order remains unconfirmed until a pharmacy verifies actual medicine availability.

## 2. Technology Stack

- React Native with TypeScript
- Expo development build
- Expo Router
- Firebase Authentication
- Cloud Firestore
- Cloud Functions for Firebase
- Cloud Storage for Firebase
- Firebase Cloud Messaging
- Firebase App Check
- Firebase Crashlytics and Analytics
- Zustand for local application state
- React Hook Form and Zod for forms
- React Native Reanimated
- React Native Gesture Handler
- `@gorhom/bottom-sheet`
- React Native Maps
- Jest and React Native Testing Library

Use current stable package versions when creating the project.

## 3. Project Creation

```bash
npx create-expo-app@latest pharmaflow-user --template
cd pharmaflow-user
npx expo install expo-dev-client expo-router expo-location expo-image-picker expo-document-picker
npm install @react-native-firebase/app @react-native-firebase/auth
npm install @react-native-firebase/firestore @react-native-firebase/functions
npm install @react-native-firebase/storage @react-native-firebase/messaging
npm install @react-native-firebase/app-check @react-native-firebase/crashlytics @react-native-firebase/analytics
npm install zustand zod react-hook-form @hookform/resolvers
npm install react-native-reanimated react-native-gesture-handler @gorhom/bottom-sheet
npm install react-native-maps
```

Expo Go cannot load React Native Firebase native modules. Configure `google-services.json`,
`GoogleService-Info.plist`, the required Expo config plugins, and use an Expo development build.

## 4. Required Folder Structure

```text
src/
├── app/
│   ├── _layout.tsx
│   ├── (auth)/
│   │   ├── welcome.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── verify-otp.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── index.tsx
│   │   ├── search.tsx
│   │   ├── orders.tsx
│   │   └── profile.tsx
│   ├── pharmacy/
│   │   └── [id].tsx
│   ├── medicine/
│   │   └── [id].tsx
│   ├── order/
│   │   ├── checkout.tsx
│   │   ├── confirmation.tsx
│   │   ├── [id].tsx
│   │   └── tracking.tsx
│   ├── prescription/
│   │   └── upload.tsx
│   ├── addresses/
│   ├── notifications.tsx
│   └── map.tsx
├── components/
│   ├── ui/
│   ├── cards/
│   ├── feedback/
│   ├── forms/
│   └── maps/
├── features/
│   ├── auth/
│   ├── home/
│   ├── medicines/
│   ├── pharmacies/
│   ├── prescriptions/
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── tracking/
│   ├── payments/
│   ├── notifications/
│   ├── reviews/
│   └── profile/
├── hooks/
├── services/
│   ├── api/
│   ├── socket/
│   ├── notifications/
│   ├── location/
│   └── storage/
├── store/
├── theme/
├── types/
├── utils/
├── constants/
└── config/
```

## 5. Engineering Rules

- Enable TypeScript strict mode.
- A component must not exceed 200 lines.
- Screens orchestrate features; business logic belongs in hooks and services.
- Do not place direct HTTP requests inside UI components.
- Do not use mock data in production screens.
- Every button must perform a real action or visibly indicate why it is unavailable.
- Use `React.memo` for stable, reusable presentation components.
- Use `useCallback` for callbacks passed into memoized children.
- Use `useMemo` only for meaningful calculations or stable derived data.
- Use TanStack Query for API data and cache invalidation.
- Use Zustand only for client-owned state such as authentication and cart state.
- Store refresh tokens and sensitive values in secure native storage.
- Never store authentication tokens in AsyncStorage.
- Add loading, skeleton, empty, error, retry, and success states.
- Use feature-level error boundaries.
- Support accessibility labels, dynamic text sizing, and a minimum 44-point touch target.

## 6. Design System

### Brand Colors

```ts
export const colors = {
  primary: '#087C61',
  primaryDark: '#05624C',
  primarySoft: '#DFF3EC',
  background: '#F5F8F6',
  surface: '#FFFFFF',
  text: '#17231F',
  textMuted: '#718079',
  border: '#E3EAE6',
  success: '#15805F',
  warning: '#B8751D',
  danger: '#B64E4E',
  info: '#3776BB',
} as const;
```

### Reusable Components

- `AppButton`
- `AppInput`
- `SearchBar`
- `ScreenHeader`
- `PharmacyCard`
- `MedicineCard`
- `OrderCard`
- `BookingCard`
- `StatusBadge`
- `MapBottomSheet`
- `PrescriptionPicker`
- `QuantitySelector`
- `PriceSummary`
- `AddressCard`
- `EmptyState`
- `ErrorState`
- `SkeletonLoader`
- `ConfirmationModal`
- `NetworkStatusBanner`

All components must support disabled, loading, error, and accessibility states where applicable.

## 7. Navigation

### Root Navigation

```text
Splash
├── Auth Stack
│   ├── Welcome
│   ├── Login
│   ├── Register
│   ├── Forgot Password
│   └── OTP Verification
└── Application
    ├── Home Tab
    ├── Search Tab
    ├── Orders Tab
    ├── Profile Tab
    └── Modal Screens
```

Deep links must support:

```text
pharmaflow://order/:orderId
pharmaflow://medicine/:medicineId
pharmaflow://pharmacy/:pharmacyId
pharmaflow://prescription/:prescriptionId
pharmaflow://notifications
```

## 8. Authentication

Implement:

- Email or phone login
- Registration
- OTP verification
- Firebase password-reset email
- Firebase native session restoration
- Logout from current device
- Guest medicine and pharmacy browsing
- Authentication requirement before checkout

Use Firebase Authentication as the only identity provider. Cloud Functions must verify the
Firebase ID token automatically through callable functions. Roles are stored as protected custom
claims (`USER`, `PHARMACY`, `DRIVER`, `ADMIN`, and `SUPER_ADMIN`) and must never be assigned by
the mobile client. Firebase manages ID-token refresh and native session persistence.

## 9. Main Screens

### Welcome

- Login
- Create account
- Continue as guest

### Home

- Current delivery location
- Notification indicator
- Medicine and pharmacy search
- Upload prescription
- My orders
- Nearby pharmacies
- Reorder
- Medicine categories
- Nearby pharmacy cards
- Map preview

### Search

- Debounced API search
- Search by medicine, generic name, brand, and pharmacy
- Recent searches stored locally
- Popular searches loaded from the API
- Prescription-required badge
- Filters for form, strength, category, and prescription requirement

### Pharmacy Map

- Current user location
- Verified pharmacy markers
- Marker clustering
- Radius filter
- Open-now filter
- Delivery availability filter
- Animated pharmacy bottom sheet
- Swipe down to close and swipe up to expand
- Request location permission only when the feature requires it

### Medicine Details

- Image
- Name and generic name
- Brand, form, and strength
- Description and dosage information
- Prescription requirement
- Nearby pharmacies
- Add to order
- Upload prescription

### Prescription Upload

- Camera capture
- Gallery selection
- PDF selection
- Preview and removal
- Secure multipart upload
- Upload progress
- Retry after failure
- Pharmacy-searching confirmation

### Cart

- Items and quantities
- Pharmacy grouping
- Price availability state
- Remove and update quantity
- One-pharmacy selection
- Split-order option
- Prescription validation

Prices and stock shown in the cart are provisional until the pharmacy confirms them.

### Checkout

- Address selection and creation
- Delivery or pickup
- Cash, card, or wallet payment
- Voucher or discount
- Subtotal, delivery fee, service fee, discount, and total
- Idempotent order submission
- Explicit pharmacy-confirmation notice

### Orders

- Active and previous orders
- Reusable order cards
- Status filters
- Reorder action
- Cancel action when allowed
- Pull-to-refresh

### Order Details

- Order and pharmacy information
- Confirmed and unavailable items
- Payment status
- Status timeline
- Delivery map
- Pharmacy, driver, and support contact actions

### Live Tracking

- Pharmacy location
- Customer location
- Live driver marker
- Route polyline
- ETA
- Driver name and rating
- Call and chat

## 10. Hybrid Pharmacy Availability Flow

```text
User submits order
        ↓
Backend creates order
        ↓
Nearby pharmacies receive requests
        ↓
Pharmacies verify actual availability
        ↓
One pharmacy atomically accepts
        ↓
Other pharmacy requests expire
        ↓
User receives confirmed items and prices
        ↓
Preparation begins
```

The mobile application must display provisional states clearly:

- Searching for pharmacy
- Pharmacy checking availability
- Partial availability offered
- Pharmacy confirmed
- No pharmacy available

The client must never decide which pharmacy wins. Acceptance concurrency is enforced by the backend transaction.

## 11. Order Statuses

```ts
export type OrderStatus =
  | 'PENDING'
  | 'SEARCHING_PHARMACY'
  | 'PHARMACY_REQUESTED'
  | 'PHARMACY_CHECKING'
  | 'PHARMACY_CONFIRMED'
  | 'PREPARING'
  | 'READY_FOR_PICKUP'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REFUNDED';
```

Status transitions received from the server are authoritative.

## 12. Firebase Service Layer

Use Firebase client SDKs for authentication, permitted Firestore reads, live listeners, Storage
uploads, and FCM registration. Use callable Cloud Functions for every privileged mutation.

```ts
import functions from '@react-native-firebase/functions';

const createOrder = functions().httpsCallable('createOrder');
const result = await createOrder({
  idempotencyKey,
  items,
  addressId,
  deliveryType,
  paymentMethod,
});
```

Required service modules:

- `firebase.ts`
- `auth.service.ts`
- `firestore.service.ts`
- `functions.service.ts`
- `medicine.service.ts`
- `pharmacy.service.ts`
- `prescription.service.ts`
- `order.service.ts`
- `payment.service.ts`
- `address.service.ts`
- `notification.service.ts`
- `review.service.ts`
- `chat.service.ts`

Callable Cloud Functions:

```text
createOrder
cancelOrder
reorder
acceptPharmacyOrder
rejectPharmacyOrder
offerPartialOrder
createPaymentIntent
confirmPayment
submitReview
registerDevice
markNotificationRead
```

Firestore and Storage triggers:

```text
dispatchOrderToPharmacies
sendOrderStatusNotification
processPrescriptionUpload
expirePharmacyRequests
calculateOrderCommission
createAuditLog
```

The `createOrder` function must require an idempotency key. App Check and authenticated Firebase
ID tokens are mandatory for callable production functions.

## 13. State Management

### Firestore

Use typed Firestore converters and listeners for medicines, pharmacies, orders, addresses,
notifications, reviews, and user profiles. Subscribe only to active screens and always detach
listeners during cleanup.

### Zustand

Use for:

- In-memory authenticated user
- Cart items
- Selected location
- Checkout draft
- Temporary UI preferences

Do not duplicate Firestore documents in Zustand.

## 14. Real-Time Events

Use Firestore `onSnapshot` listeners instead of Socket.IO:

```text
orders/{orderId}
orders/{orderId}/events
deliveries/{deliveryId}
deliveries/{deliveryId}/locations/current
chats/{chatId}/messages
users/{userId}/notifications
```

Security Rules must restrict every listener to the user, assigned pharmacy, assigned driver, or
authorized admin. High-frequency driver locations should use one current-location document rather
than creating an unbounded document for every GPS update.

## 15. Push Notifications

Implement Firebase Cloud Messaging for:

- Pharmacy accepted order
- Partial availability offered
- Order preparation started
- Order ready
- Driver assigned
- Driver nearby
- Order delivered
- Payment result
- Prescription update

Notification taps must navigate to the relevant order, prescription, or payment screen.

## 16. Maps and Location

- Ask for foreground permission with a clear explanation.
- Do not block medicine browsing if location is denied.
- Allow manual address search.
- Send latitude and longitude for nearby-pharmacy queries.
- Request live driver updates only while tracking an active delivery.
- Stop background subscriptions when they are unnecessary.
- Do not expose precise customer coordinates to unauthorized clients.

## 17. Error Handling

Normalize API errors into:

```ts
export interface AppError {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  retryable: boolean;
}
```

Handle:

- No network connection
- Request timeout
- Expired authentication
- Validation failure
- Prescription upload failure
- Payment failure
- Pharmacy timeout
- Medicine unavailability
- Order conflict
- Location permission denial
- Socket disconnection

## 18. Security

- Use HTTPS only in production.
- Validate all form and API payloads.
- Redact tokens, passwords, prescriptions, and payment data from logs.
- Use signed URLs for private prescription files.
- Apply certificate pinning only with a safe certificate-rotation strategy.
- Do not store card details in the application.
- Use a PCI-compliant payment provider.
- Verify deep-link parameters before navigation.
- Clear sensitive query and local state during logout.
- Add root/jailbreak risk detection only if required by the business threat model.

## 19. Environment Variables

```env
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
EXPO_PUBLIC_FIREBASE_REGION=asia-south1
EXPO_PUBLIC_USE_FIREBASE_EMULATORS=false
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Firebase native app configuration comes from `google-services.json` and
`GoogleService-Info.plist`. These identify the Firebase app but do not replace Firestore Rules,
Storage Rules, App Check, or authorization. Never place service-account keys or server secrets in
the mobile project.

## 20. Testing

Required tests:

- Authentication validation and session restoration
- Search debounce and result rendering
- Cart quantity and pharmacy grouping
- Prescription upload validation
- Checkout calculation
- Duplicate-submit prevention
- Order status rendering
- Partial-availability flow
- Push-notification deep linking
- Socket event cache updates
- Location permission rejection
- Logout data cleanup

Test complete flows on both Android and iOS physical devices before release.

## 21. Development Order

### Phase 1 — Foundation

1. Project setup
2. Navigation
3. Design system
4. Types
5. API client
6. Authentication state
7. Error handling

### Phase 2 — Marketplace

1. Authentication screens
2. Home
3. Medicine search
4. Medicine details
5. Pharmacy discovery
6. Map and bottom sheet
7. Prescription upload

### Phase 3 — Ordering

1. Cart
2. Address management
3. Checkout
4. Order creation
5. Pharmacy-searching states
6. Partial availability
7. Order details

### Phase 4 — Delivery

1. Real-time status events
2. Push notifications
3. Driver tracking
4. Chat
5. Delivery confirmation

### Phase 5 — Commerce and Quality

1. Card and wallet payments
2. Reviews
3. Reorder
4. Offers
5. Analytics and monitoring
6. Accessibility and performance audit

## 22. Definition of Done

A feature is complete only when:

- It uses a real API contract.
- Loading, empty, error, retry, and success states exist.
- Buttons and gestures perform real actions.
- Validation is implemented.
- Accessibility labels are present.
- Analytics and error monitoring are included where required.
- Unit or integration tests cover important behavior.
- Android and iOS behavior has been verified.
- No secrets or personal medical information appear in logs.
- Components remain reusable and below 200 lines.
