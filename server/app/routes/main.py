from flask import Blueprint, jsonify, request
from app import supabase
from marshmallow import Schema, fields, validate

bp = Blueprint('main', __name__)

class CardSchema(Schema):
    card_number = fields.Str(required=True, validate=validate.Length(min=16, max=16))
    expiry_date = fields.Str(required=True, validate=validate.Length(min=5, max=5))
    cvv = fields.Str(required=True, validate=validate.Length(min=3, max=3))
    cardholder_name = fields.Str(required=True)

class UserSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))
    name = fields.Str(required=True)

class LoginSchema(Schema):
    email = fields.Email(required=True)
    password = fields.Str(required=True)

@bp.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

@bp.route('/auth/signup', methods=['POST'])
def signup():
    schema = UserSchema()
    try:
        data = schema.load(request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Create user in Supabase Auth with proper metadata format
        auth_response = supabase.auth.sign_up({
            'email': data['email'],
            'password': data['password'],
            'options': {
                'data': {
                    'name': data['name']
                }
            }
        })

        if auth_response.user:
            user = auth_response.user
            return jsonify({
                'message': 'User created successfully',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.user_metadata.get('name')
                },
                'session': {
                    'access_token': auth_response.session.access_token,
                    'refresh_token': auth_response.session.refresh_token,
                    'expires_in': auth_response.session.expires_in,
                    'expires_at': auth_response.session.expires_at,
                    'token_type': auth_response.session.token_type
                }
            }), 201
        else:
            return jsonify({'error': 'Failed to create user'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/auth/login', methods=['POST'])
def login():
    schema = LoginSchema()
    try:
        data = schema.load(request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    try:
        # Authenticate user with Supabase
        auth_response = supabase.auth.sign_in_with_password({
            'email': data['email'],
            'password': data['password']
        })

        if auth_response.user:
            user = auth_response.user
            return jsonify({
                'message': 'Login successful',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.user_metadata.get('name'),
                    'email_verified': user.user_metadata.get('email_verified', False)
                },
                'session': {
                    'access_token': auth_response.session.access_token,
                    'refresh_token': auth_response.session.refresh_token,
                    'expires_in': auth_response.session.expires_in,
                    'expires_at': auth_response.session.expires_at,
                    'token_type': auth_response.session.token_type
                }
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/auth/me', methods=['GET'])
def get_current_user():
    try:
        # Get the current session from the request
        session = supabase.auth.get_session()
        if not session:
            return jsonify({'error': 'Not authenticated'}), 401
            
        user = session.user
        return jsonify({
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.user_metadata.get('name'),
                'email_verified': user.user_metadata.get('email_verified', False)
            },
            'session': {
                'access_token': session.access_token,
                'refresh_token': session.refresh_token,
                'expires_in': session.expires_in,
                'expires_at': session.expires_at,
                'token_type': session.token_type
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500 

@bp.route('/cards', methods=['POST'])
def add_card():
    schema = CardSchema()
    try:
        data = schema.load(request.json)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

    # In a real application, you would:
    # 1. Validate the user is authenticated
    # 2. Encrypt sensitive data
    # 3. Use a payment processor to validate the card
    
    try:
        # Insert card into Supabase
        response = supabase.table('cards').insert({
            'user_id': 1,  # This should come from the authenticated user
            'card_number': data['card_number'],
            'expiry_date': data['expiry_date'],
            'cvv': data['cvv'],
            'cardholder_name': data['cardholder_name'],
            'is_default': False
        }).execute()
        
        return jsonify({'message': 'Card added successfully', 'data': response.data}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/cards', methods=['GET'])
def get_cards():
    try:
        # Get cards from Supabase
        response = supabase.table('cards').select('*').eq('user_id', 1).execute()
        
        # Mask card numbers
        cards = [{
            'id': card['id'],
            'card_number': f'**** **** **** {card["card_number"][-4:]}',
            'expiry_date': card['expiry_date'],
            'cardholder_name': card['cardholder_name'],
            'is_default': card['is_default']
        } for card in response.data]
        
        return jsonify(cards)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
