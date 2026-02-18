# Event Management System - MERN Stack

## Implemented Scope

This project implements the full core system and selected advanced features from the rubric.

### Core Features
- Authentication and security with JWT, bcrypt, role-based access, and protected frontend routes.
- Participant registration/login, organizer login, admin login, and profile APIs.
- Participant onboarding/preferences: areas of interest + followed clubs.
- Event management: organizer draft creation, custom form builder fields, publish and status transitions.
- Participant browse with search/filter/trending and detailed event view.
- Registration workflow with ticket IDs and QR generation for non-paid registrations.
- Merchandise flow with payment proof upload and organizer approval/rejection.
- Participant dashboard with upcoming events + participation history tabs.
- Organizer dashboard and event management page with participant listing/search/export CSV.
- Admin dashboards for stats, organizer management, and password reset request handling.

### Advanced Features Implemented (30 Marks)

#### Tier A (2 selected)
1. Hackathon Team Registration
   - Team creation, invite code sharing, team joining, team completion tracking.
2. Merchandise Payment Approval Workflow
   - Payment proof upload, pending approvals queue, approve/reject workflow, stock decrement on approval, QR issuance after approval.

#### Tier B (2 selected)
1. Real-Time Discussion Forum (implemented as API-driven forum; polling-based frontend refresh)
   - Event-wise posts, organizer pin/unpin, delete moderation, message reactions.
2. Organizer Password Reset Workflow
   - Request creation, admin review, status tracking, auto-generated temporary password and email notification.

#### Tier C (1 selected)
1. Anonymous Feedback System
   - Anonymous rating + comments, organizer-side event feedback analytics and filters.

## Technology Stack
- Frontend: React, React Router, Axios
- Backend: Node.js, Express
- Database: MongoDB (Mongoose)
- Auth/Security: JWT, bcrypt
- Uploads: Multer
- Email: Nodemailer
- QR: qrcode

## Local Setup

### Backend
1. `cd backend`
2. `npm install`
3. Create `.env` with:
   - `PORT=5000`
   - `MONGO_URI=...`
   - `JWT_SECRET=...`
   - `JWT_EXPIRE=7d`
   - `EMAIL_USER=...`
   - `EMAIL_PASS=...`
   - `FRONTEND_URL=http://localhost:3000`
4. `npm run dev`

### Frontend
1. `cd frontend`
2. `npm install`
3. Create `.env` with:
   - `REACT_APP_API_URL=http://localhost:5000/api`
4. `npm start`

## Default Roles and Flow
- Participant: signup from UI.
- Organizer: created by admin from admin panel.
- Admin: must exist in DB (seed manually or by script).

## Notes
- Frontend build passes (`npm run build`).
- Backend syntax checks pass (`node --check` across backend files).
