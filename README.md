# SmartSwipe

A modern payment management application with React frontend and Flask backend, powered by Supabase.

## Project Structure

```
smart-swipe/
├── client/           # React frontend
└── server/           # Flask backend
```

## Setup

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Create a `.env` file in the server directory:
   ```
   SUPABASE_URL=your-project-url
   SUPABASE_KEY=your-anon-key
   SECRET_KEY=your-secret-key
   ```

5. Run the Flask server:
   ```bash
   python run.py
   ```

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

## Development

- Frontend runs on http://localhost:3000
- Backend API runs on http://localhost:5000
- The frontend is configured to proxy API requests to the backend

## Features

- Add and manage payment cards
- Secure card information storage in Supabase
- Modern React frontend with TypeScript
- RESTful Flask backend
- Real-time updates with Supabase
