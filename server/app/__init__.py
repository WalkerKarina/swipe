from flask import Flask
from flask_cors import CORS
from supabase import Client, create_client
from dotenv import load_dotenv
import os

# Load environment variables
load_dotenv()

# Initialize Supabase client
supabase: Client = None

def create_app():
    app = Flask(__name__)
    
    # Configure the Flask application
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev')
    
    # Initialize CORS with specific configuration
    CORS(app, 
         resources={r"/*": {"origins": ["http://localhost:3000", "http://127.0.0.1:3000", "https://www.smartswipe.co"]}},
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])
    
    # Initialize Supabase
    global supabase
    supabase_url = os.getenv('SUPABASE_URL')
    supabase_key = os.getenv('SUPABASE_KEY')
    
    if not supabase_url or not supabase_key:
        raise ValueError("Supabase URL and key must be set in environment variables")
    
    supabase = create_client(supabase_url, supabase_key)
    
    # Register blueprints
    from app.routes import main
    from app.transactions.plaid import plaid_bp
    app.register_blueprint(main.bp, url_prefix='/api')
    app.register_blueprint(plaid_bp, url_prefix='/api')
    
    return app 
