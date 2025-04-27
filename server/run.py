from dotenv import load_dotenv
import os
from app import create_app

# Load environment variables
load_dotenv()

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
