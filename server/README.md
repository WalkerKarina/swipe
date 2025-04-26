# Flask Supabase Server

A minimal Flask server connected to Supabase.

### Supabase Setup

1. Create a Supabase project:
   - Go to [Supabase](https://supabase.com)
   - Create a new project
   - Note down your project URL and anon key
  

## Setup
1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Create a `.env` file:
   ```
   SUPABASE_URL=your-project-url
   SUPABASE_KEY=your-anon-key
   SECRET_KEY=your-secret-key
   ```

4. Run the server:
   ```bash
   python run.py
   ```

## API Endpoints

- `GET /api/health` - Health check endpoint
- `GET /api/example` - Example Supabase query
- `POST /api/example` - Example Supabase insert

## Project Structure

```
server/
├── app/
│   ├── __init__.py      # App factory and Supabase setup
│   └── routes/
│       └── main.py      # API routes
├── requirements.txt     # Python dependencies
└── run.py              # Server entry point
``` 
