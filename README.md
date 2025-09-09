# TiDB AgentX Project

Full-stack application with emotion-based YouTube video recommendations using TiDB vector search.

## Project Structure

```
tidb-agentx-project/
├── backend/            # Backend Node.js application
│   ├── src/
│   │   ├── controllers/  # API controllers
│   │   ├── services/     # Business logic
│   │   ├── models/       # Database models
│   │   ├── routes/       # API routes
│   │   └── app.js        # Express app
│   ├── public/           # Static files
│   ├── uploads/          # Upload directory
│   └── package.json      # Backend dependencies
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/   # React components
│   │   └── utils/        # Utilities
│   ├── public/           # Static assets
│   └── package.json      # Frontend dependencies
└── package.json        # Root monorepo configuration
```

## Setup Instructions

### Quick Start (All-in-one)

```bash
# Install all dependencies (root, backend, and frontend)
npm run install:all

# Set up environment variables
cp backend/.env.example backend/.env
# Configure your backend/.env with TiDB and API credentials

# Run database migrations
npm run setup

# Start both backend and frontend in development mode
npm run dev
```

### Individual Setup

#### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run setup

# Start backend server (port 3002)
npm start
```

#### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install frontend dependencies
npm install

# Start development server (port 5173)
npm run dev
```

## Features

- **Microsoft Teams Integration**: OAuth authentication and meeting context
- **Emotion Analysis**: AWS Rekognition for facial emotion detection
- **YouTube Video Curation**: Vector similarity search using TiDB
- **Smart Recommendations**: Based on liked videos and user context
- **Real-time Filtering**: Multi-criteria video filtering with emotion, meetings, and description

## API Endpoints

### Authentication
- `GET /api/auth/teams` - Teams OAuth login
- `GET /api/auth/teams/callback` - OAuth callback

### Agent
- `POST /api/agent/ingest` - Ingest videos with context
- `POST /api/agent/filter` - Filter videos based on criteria

### YouTube
- `GET /api/youtube/search` - Search YouTube videos
- `GET /api/youtube/:videoId/recommendations` - Get video recommendations

### Meetings
- `GET /api/meetings` - Fetch user meetings from database

## Technologies

- **Backend**: Node.js, Express, TiDB Serverless
- **Frontend**: React, Vite
- **Database**: TiDB with vector search capabilities
- **AI/ML**: OpenAI embeddings, AWS Rekognition
- **Authentication**: Microsoft Teams OAuth 2.0

## Development

```bash
# Run both backend and frontend in development mode
npm run dev

# Or run individually:
npm run dev:backend  # Backend only (port 3002)
npm run dev:frontend # Frontend only (port 5173)
```

## Production Deployment

The application is ready for deployment with:
- Backend API on port 3002
- Frontend build served statically
- Environment-based configuration
- Production-ready error handling