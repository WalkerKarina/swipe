import os
import requests
import json
from flask import Blueprint, jsonify, request
from datetime import datetime, timedelta
import logging
from app import supabase
from marshmallow import Schema, fields, post_load, EXCLUDE
from app.transactions.rewards import REWARDS_PROGRAMS
import functools
from typing import Callable

plaid_bp = Blueprint('plaid', __name__)

# Configure logging
logger = logging.getLogger('plaid')
logger.setLevel(logging.INFO) 

# Add console handler for debugging
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
console_handler.setFormatter(formatter)
logger.addHandler(console_handler)

def require_user_id(f: Callable) -> Callable:
    """
    Decorator to extract user_id from request and pass it to the function.
    This handles the repetitive user ID extraction code found in multiple endpoints.
    """
    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        # Check for user_id in query parameter first
        user_id = request.args.get('user_id')
        if not user_id:
            # Try authentication header
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                token = auth_header.split(' ')[1]
                try:
                    # Try to get user from token
                    response = supabase.auth.get_user(token)
                    if response and response.user:
                        user_id = response.user.id
                except Exception as e:
                    logger.warning(f"Error verifying token: {str(e)}")
            
            # For testing, if no user found, use a default
            if not user_id:
                user_id = "00000000-0000-0000-0000-000000000000"
        
        # Add user_id to kwargs
        kwargs['user_id'] = user_id
        return f(*args, **kwargs)
    
    return decorated_function

# Define Marshmallow schemas for Plaid data
class PlaidAccountSchema(Schema):
    """Schema for Plaid account data"""
    class Meta:
        unknown = EXCLUDE
        
    # Core account fields
    account_id = fields.Str(required=True)
    name = fields.Str(required=True)
    mask = fields.Str(missing='')
    type = fields.Str(missing='')
    subtype = fields.Str(missing='')
    
    # Additional Plaid fields
    balances = fields.Dict(allow_none=True)
    official_name = fields.Str(allow_none=True)
    verification_status = fields.Str(allow_none=True)
    
    # Custom fields not from Plaid but used in our app
    institution_name = fields.Str(missing='Financial Institution')

class TransactionSchema(Schema):
    """Schema for Plaid transaction data based on their API documentation"""
    class Meta:
        unknown = EXCLUDE
    
    # Core transaction fields
    id = fields.Str(required=True, data_key="transaction_id")
    account_id = fields.Str(required=True)
    amount = fields.Float(required=True)  # Will be negated in post_load
    date = fields.Str(required=True)
    name = fields.Str(required=True)
    
    # Standard Plaid fields
    pending = fields.Bool(missing=False)
    payment_channel = fields.Str(missing="other")
    authorized_date = fields.Str(allow_none=True)
    authorized_datetime = fields.Str(allow_none=True)
    datetime = fields.Str(allow_none=True)
    category_id = fields.Str(allow_none=True)
    check_number = fields.Str(allow_none=True)
    location = fields.Dict(allow_none=True)
    merchant_name = fields.Str(allow_none=True)
    original_description = fields.Str(allow_none=True)
    payment_meta = fields.Dict(allow_none=True)
    transaction_code = fields.Str(allow_none=True)
    transaction_type = fields.Str(allow_none=True)
    unofficial_currency_code = fields.Str(allow_none=True)
    iso_currency_code = fields.Str(allow_none=True)
    
    # Category is a special case since we process it
    # Using Raw allows accepting different formats (list or string)
    category = fields.Raw(allow_none=True)
    
    # Custom fields we add from our database
    account_name = fields.Str(missing="Unknown Account")
    institution_name = fields.Str(missing="Unknown Institution")
    
    @post_load
    def process_transaction(self, data, **kwargs):
        """Process the transaction data after loading"""
        try:
            # Negate the amount as Plaid reports expenses as positive
            if 'amount' in data and data['amount'] is not None:
                data['amount'] = -float(data['amount'])
            
            # Process the category to get the primary category
            if 'category' in data and data['category'] is not None:
                if isinstance(data['category'], list) and data['category']:
                    # Just take the first category as a string
                    first_category = data['category'][0] if data['category'] else "Other"
                    logger.debug(f"First category from list: {first_category}, type: {type(first_category)}")
                    data['category'] = first_category
                elif isinstance(data['category'], str):
                    # If it's already a string, check if it's a stringified list
                    if data['category'].startswith('[') and data['category'].endswith(']'):
                        try:
                            # Try to parse it as JSON
                            parsed = json.loads(data['category'].replace("'", '"'))
                            if isinstance(parsed, list) and parsed:
                                data['category'] = parsed[0]
                        except:
                            # If parsing fails, keep as is
                            pass
                else:
                    data['category'] = "Other"
            else:
                data['category'] = "Other"
                
            return data
        except Exception as e:
            logger.error(f"Error in post_load processing: {e}")
            # Return original data if processing fails
            data['category'] = "Other"  # Fallback to ensure we have a string
            return data

class TransactionListSchema(Schema):
    """Schema for a list of transactions"""
    class Meta:
        unknown = EXCLUDE
        
    data = fields.List(fields.Nested(TransactionSchema))
    status = fields.Str(default="success")
    message = fields.Str(default="Transactions retrieved successfully")

class CategorySummarySchema(Schema):
    """Schema for category summary data"""
    class Meta:
        unknown = EXCLUDE
        
    count = fields.Int(required=True)
    amount = fields.Float(required=True)

class AccountSummarySchema(Schema):
    """Schema for account summary data"""
    class Meta:
        unknown = EXCLUDE
        
    name = fields.Str(required=True)
    count = fields.Int(required=True)
    amount = fields.Float(required=True)

class TransactionSummarySchema(Schema):
    """Schema for transaction summary data"""
    class Meta:
        unknown = EXCLUDE
        
    total_transactions = fields.Int(required=True)
    total_amount = fields.Float(required=True)
    income = fields.Float(required=True)
    expenses = fields.Float(required=True)
    categories = fields.Dict(keys=fields.Str(), values=fields.Nested(CategorySummarySchema))
    accounts = fields.Dict(keys=fields.Str(), values=fields.Nested(AccountSummarySchema))
    institutions = fields.Dict(keys=fields.Str(), values=fields.Nested(CategorySummarySchema))

class TransactionSummaryResponseSchema(Schema):
    """Schema for transaction summary response"""
    class Meta:
        unknown = EXCLUDE
        
    status = fields.Str(default="success")
    message = fields.Str(default="Transaction summary retrieved successfully")
    data = fields.Nested(TransactionSummarySchema)

def get_plaid_base_url():
    """Get the appropriate Plaid API URL based on environment."""
    env = os.getenv('PLAID_ENV', 'sandbox')
    if env == 'development':
        return 'https://development.plaid.com'
    elif env == 'production':
        return 'https://production.plaid.com'
    else:
        return 'https://sandbox.plaid.com'

@plaid_bp.route('/plaid/create-link-token', methods=['POST'])
def create_link_token():
    """Create a link token for initializing Plaid Link."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        if not client_id or not secret:
            return jsonify({'error': 'Plaid credentials not configured'}), 500
            
        # Use a value from the request body or a default
        user_id = request.json.get('userId', 'user-id')
        
        # Get products and country codes from env or use defaults
        products = os.getenv('PLAID_PRODUCTS', 'transactions').split(',')
        country_codes = os.getenv('PLAID_COUNTRY_CODES', 'US').split(',')
        
        # Create the link token
        payload = {
            'client_id': client_id,
            'secret': secret,
            'user': {
                'client_user_id': user_id
            },
            'client_name': 'SmartSwipe',
            'products': products,
            'country_codes': country_codes,
            'language': 'en'
        }
        
        url = f"{get_plaid_base_url()}/link/token/create"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Error creating link token: {response.text}")
            return jsonify({
                'error': 'Failed to create link token', 
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        logger.exception(f"Exception in create_link_token: {str(e)}")
        return jsonify({'error': str(e)}), 500

@plaid_bp.route('/plaid/exchange-token', methods=['POST'])
def exchange_token():
    """Exchange a public token for an access token."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        if not client_id or not secret:
            return jsonify({'error': 'Plaid credentials not configured'}), 500
            
        # Get the public token from the request
        public_token = request.json.get('public_token')
        if not public_token:
            return jsonify({'error': 'Missing public token'}), 400
            
        # Always prefer userId from request body (for frontend integration)
        user_id = request.json.get('userId')
        if not user_id:
            # For testing, use a default user ID
            user_id = "00000000-0000-0000-0000-000000000000"
            
        # Exchange the public token for an access token
        payload = {
            'client_id': client_id,
            'secret': secret,
            'public_token': public_token
        }
        
        url = f"{get_plaid_base_url()}/item/public_token/exchange"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            exchange_data = response.json()
            access_token = exchange_data.get('access_token')
            item_id = exchange_data.get('item_id')
            
            # Get institution information
            institution_info = get_institution(access_token)
            institution_id = institution_info.get('institution_id', '')
            institution_name = institution_info.get('name', 'Financial Institution')
            
            # Now get account information
            accounts = get_accounts(access_token)
            
            # Store in Supabase
            # First, insert the plaid item
            plaid_item_result = supabase.table('plaid_items').insert({
                'user_id': user_id,
                'item_id': item_id,
                'access_token': access_token,
                'institution_id': institution_id,
                'institution_name': institution_name
            }).execute()
            
            # Get the inserted plaid_item_id
            if plaid_item_result.data and len(plaid_item_result.data) > 0:
                plaid_item_id = plaid_item_result.data[0]['id']
                
                # Store accounts
                for account in accounts:
                    supabase.table('plaid_accounts').insert({
                        'plaid_item_id': plaid_item_id,
                        'account_id': account.get('account_id'),
                        'name': account.get('name'),
                        'mask': account.get('mask', ''),
                        'type': account.get('type', ''),
                        'subtype': account.get('subtype', '')
                    }).execute()
            
            # Format response accounts
            response_accounts = []
            for account in accounts:
                response_accounts.append({
                    'id': account.get('account_id'),
                    'name': account.get('name'),
                    'institutionName': institution_name,
                    'mask': account.get('mask', '')
                })
            
            return jsonify({
                'success': True,
                'message': 'Account linked successfully',
                'accounts': response_accounts
            })
        else:
            logger.error(f"Error exchanging token: {response.text}")
            return jsonify({
                'error': 'Failed to exchange token', 
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        logger.exception(f"Exception in exchange_token: {str(e)}")
        return jsonify({'error': str(e)}), 500

@plaid_bp.route('/plaid/accounts', methods=['GET'])
@require_user_id
def get_account_endpoint(user_id=None):
    """API endpoint to retrieve linked accounts."""
    try:
        logger.info(f"Finding accounts for user {user_id}")
        
        # Query Supabase for linked accounts
        # First get all plaid items for the user
        items_response = supabase.table('plaid_items').select('*').eq('user_id', user_id).execute()
        
        accounts = []
        if items_response.data:
            for item in items_response.data:
                item_id = item['id']
                institution_name = item.get('institution_name', 'Financial Institution')
                
                # Get accounts for this item
                accounts_response = supabase.table('plaid_accounts').select('*').eq('plaid_item_id', item_id).execute()
                
                if accounts_response.data:
                    for account in accounts_response.data:
                        accounts.append({
                            'id': account['account_id'],
                            'name': account['name'],
                            'institutionName': institution_name,
                            'mask': account.get('mask', '****')
                        })
        
        logger.info(f"Found {len(accounts)} accounts for user {user_id}")
        return jsonify({'accounts': accounts})
    except Exception as e:
        logger.exception(f"Error fetching accounts: {str(e)}")
        return jsonify({'accounts': [], 'error': str(e)})

def get_institution(access_token):
    """Get institution details for an access token."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        # First get the item to get the institution_id
        payload = {
            'client_id': client_id,
            'secret': secret,
            'access_token': access_token
        }
        
        url = f"{get_plaid_base_url()}/item/get"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            item_data = response.json()
            institution_id = item_data.get('item', {}).get('institution_id')
            
            if not institution_id:
                return {'institution_id': '', 'name': 'Financial Institution'}
            
            # Now get institution details
            institution_payload = {
                'client_id': client_id,
                'secret': secret,
                'institution_id': institution_id,
                'country_codes': ['US']
            }
            
            institution_url = f"{get_plaid_base_url()}/institutions/get_by_id"
            
            institution_response = requests.post(institution_url, headers=headers, json=institution_payload)
            
            if institution_response.status_code == 200:
                institution_data = institution_response.json()
                return {
                    'institution_id': institution_id,
                    'name': institution_data.get('institution', {}).get('name', 'Financial Institution')
                }
        
        return {'institution_id': '', 'name': 'Financial Institution'}
    except Exception as e:
        logger.exception(f"Exception getting institution: {str(e)}")
        return {'institution_id': '', 'name': 'Financial Institution'}

def get_accounts(access_token):
    """Get accounts associated with an access token."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        payload = {
            'client_id': client_id,
            'secret': secret,
            'access_token': access_token
        }
        
        url = f"{get_plaid_base_url()}/accounts/get"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            data = response.json()
            account_data = []
            
            for account in data.get('accounts', []):
                account_info = {
                    'account_id': account.get('account_id'),
                    'name': account.get('name'),
                    'mask': account.get('mask', ''),
                    'type': account.get('type'),
                    'subtype': account.get('subtype', ''),
                    'institution_id': '',  # Would need another API call to get this
                    'institution_name': 'Financial Institution'
                }
                account_data.append(account_info)
                
            return account_data
        else:
            print(f"Error getting accounts: {response.text}")
            return []
            
    except Exception as e:
        print(f"Exception getting accounts: {str(e)}")
        return []

@plaid_bp.route('/transactions', methods=['GET'])
@require_user_id
def get_transactions(user_id=None, return_json=True):
    """
    Endpoint to retrieve transactions from all linked accounts.
    Uses stored access tokens to get real transactions from Plaid API.
    
    Args:
        user_id: The user ID to get transactions for
        return_json: If True, returns a JSON response. If False, returns the transactions list directly
    """
    try:
        logger.info(f"Fetching transactions for user: {user_id}")
        
        # Query Supabase for all plaid items for this user
        items_response = supabase.table('plaid_items').select('*').eq('user_id', user_id).execute()
        plaid_items = items_response.data
        
        if not plaid_items:
            logger.warning(f"No linked accounts found for user: {user_id}")
            if return_json:
                return jsonify({
                    'error': 'no_linked_accounts',
                    'message': 'No linked bank accounts found'
                }), 404
            else:
                return [], 404
        
        logger.info(f"Found {len(plaid_items)} linked items for user")
        
        # Set date range for transactions (last 30 days)
        end_date = datetime.now().date()
        start_date = end_date - timedelta(days=30)
        
        all_transactions = []
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        # For each item, fetch transactions
        for item in plaid_items:
            try:
                access_token = item['access_token']
                institution_name = item.get('institution_name', 'Financial Institution')
                item_id = item.get('id', 'unknown')
                
                logger.info(f"Fetching transactions for institution: {institution_name} (item_id: {item_id})")
                
                # Get accounts for this item
                accounts_response = supabase.table('plaid_accounts').select('*').eq('plaid_item_id', item['id']).execute()
                accounts = accounts_response.data
                
                if not accounts:
                    logger.warning(f"No accounts found for item {item['id']}")
                    continue
                
                logger.info(f"Found {len(accounts)} accounts for item")
                
                account_map = {}
                for account in accounts:
                    account_map[account['account_id']] = {
                        'name': account['name'],
                        'mask': account.get('mask', ''),
                        'type': account.get('type', ''),
                        'institution_name': institution_name
                    }
                
                # Call Plaid transactions/get endpoint
                payload = {
                    'client_id': client_id,
                    'secret': secret,
                    'access_token': access_token,
                    'start_date': start_date.isoformat(),
                    'end_date': end_date.isoformat(),
                    'options': {
                        'count': 100  # Adjust as needed
                    }
                }
                
                url = f"{get_plaid_base_url()}/transactions/get"
                headers = {'Content-Type': 'application/json'}
                
                logger.info(f"Calling Plaid API: {url} with dates {start_date.isoformat()} to {end_date.isoformat()}")
                
                response = requests.post(url, headers=headers, json=payload)
                
                # Add more detailed logging around the Plaid response
                if response.status_code != 200:
                    logger.error(f"Error response from Plaid API: Status {response.status_code}")
                    logger.error(f"Response body: {response.text}")
                    continue
                
                transactions_data = response.json()
                
                # Debug: Print the raw transaction response structure
                logger.debug(f"Plaid response keys: {transactions_data.keys()}")
                
                # Log total transactions received from Plaid
                plaid_transactions = transactions_data.get('transactions', [])
                logger.info(f"Received {len(plaid_transactions)} transactions from Plaid for institution: {institution_name}")
                
                # Debug: Print a few transactions with their complete details
                for i, tx in enumerate(plaid_transactions[:2]):  # Just look at first 2 transactions
                    logger.debug(f"Transaction {i} details: {json.dumps(tx, indent=2)}")
                
                # If no transactions, log this specifically
                if not plaid_transactions:
                    logger.warning(f"No transactions returned from Plaid for this item within date range {start_date.isoformat()} to {end_date.isoformat()}")
                    continue
                
                # Log structure of first transaction for debugging
                if plaid_transactions:
                    first_transaction = plaid_transactions[0]
                    logger.debug(f"Sample transaction structure: {first_transaction.keys()}")
                    
                    # Log the category field specifically to debug issues
                    if 'category' in first_transaction:
                        cat_value = first_transaction['category']
                        logger.debug(f"Sample transaction category: {cat_value}, type: {type(cat_value)}")
                        if isinstance(cat_value, list):
                            logger.debug(f"Category list contents: {cat_value}")
                            for i, c in enumerate(cat_value):
                                logger.debug(f"  Category {i}: '{c}', type: {type(c)}")
                    
                    logger.debug(f"Sample transaction: {first_transaction}")
                
                # Process and format transactions
                for idx, transaction in enumerate(plaid_transactions):
                    # Log each transaction for debugging
                    logger.debug(f"Processing transaction {idx+1}/{len(plaid_transactions)}: {transaction.get('transaction_id')} - {transaction.get('name')}")
                    
                    try:
                        account_id = transaction.get('account_id')
                        if not account_id:
                            logger.warning(f"Transaction missing account_id: {transaction.get('transaction_id')}")
                            continue
                            
                        account_info = account_map.get(account_id, {})
                        
                        # Add account info to the transaction before validation
                        transaction['account_name'] = account_info.get('name', 'Unknown Account')
                        transaction['institution_name'] = account_info.get('institution_name', 'Unknown Institution')
                        
                        # First check if transaction has required fields before schema validation
                        required_fields = ['transaction_id', 'date', 'name', 'amount', 'account_id']
                        missing_fields = [field for field in required_fields if field not in transaction or transaction[field] is None]
                        
                        if missing_fields:
                            logger.warning(f"Transaction is missing required fields: {missing_fields}")
                            continue
                        
                        # Use the schema to validate and format the transaction
                        try:
                            # Log the raw category before loading
                            if 'category' in transaction:
                                logger.debug(f"Raw category before schema load: {transaction['category']} (type: {type(transaction['category'])})")
                            
                            # Validate and transform the transaction using the schema
                            transaction_schema = TransactionSchema()
                            formatted_transaction = transaction_schema.load(transaction)
                            
                            # Log the category after processing
                            if 'category' in formatted_transaction:
                                logger.debug(f"Processed category after schema load: {formatted_transaction['category']} (type: {type(formatted_transaction['category'])})")
                            
                            all_transactions.append(formatted_transaction)
                        except Exception as schema_error:
                            logger.error(f"Error validating transaction {transaction.get('transaction_id')}: {schema_error}")
                            # Print the transaction for deeper debugging
                            logger.error(f"Problematic transaction: {transaction}")
                            # Skip invalid transactions instead of failing the entire request
                            continue
                    except Exception as e:
                        logger.exception(f"Error processing transaction: {e}")
                        continue

            except Exception as e:
                logger.exception(f"Error processing item: {str(e)}")
        
        # Log total number of valid transactions
        logger.info(f"Total valid transactions after processing: {len(all_transactions)}")
        
        # Sort transactions by date (newest first)
        if all_transactions:
            all_transactions.sort(key=lambda x: x['date'], reverse=True)
        
        # Debug final transactions
        logger.debug(f"Final transactions count: {len(all_transactions)}")
        if all_transactions:
            logger.debug(f"First transaction final data: {all_transactions[0]}")
        
        # If we want the raw data, return it directly
        if not return_json:
            return all_transactions, 200
        
        # Use the list schema to format the response
        transaction_list_schema = TransactionListSchema()
        result = transaction_list_schema.dump({"data": all_transactions})
        
        # Debug the final JSON result before sending to frontend
        logger.debug(f"Response data count: {len(result.get('data', []))}")
        
        return jsonify(result)
    except Exception as e:
        logger.exception(f"Error fetching transactions: {str(e)}")
        if return_json:
            return jsonify({
                'error': 'server_error',
                'message': str(e)
            }), 500
        else:
            return [], 500

@plaid_bp.route('/transactions/summary', methods=['GET'])
@require_user_id
def get_transaction_summary(user_id=None):
    """
    Endpoint to retrieve transaction summary/analytics across all linked accounts.
    Uses the same transaction data but provides aggregated statistics.
    """
    try:
        # Query Supabase for all plaid items for this user
        items_response = supabase.table('plaid_items').select('*').eq('user_id', user_id).execute()
        plaid_items = items_response.data
        
        if not plaid_items:
            return jsonify({
                'error': 'no_linked_accounts',
                'message': 'No linked bank accounts found'
            }), 404
        
        # Get transactions data directly
        transactions, status_code = get_transactions(user_id=user_id, return_json=False)
        
        # If error occurred or no transactions, return appropriate response
        if status_code != 200 or not transactions:
            return jsonify({
                'error': 'no_transactions',
                'message': 'Failed to retrieve transactions'
            }), status_code if status_code != 200 else 404
        
        logger.info(f"Processing {len(transactions)} transactions for summary")
        
        # Create summary
        summary = {
            'total_transactions': len(transactions),
            'total_amount': sum(abs(t['amount']) for t in transactions),
            'income': sum(t['amount'] for t in transactions if t['amount'] > 0),
            'expenses': sum(abs(t['amount']) for t in transactions if t['amount'] < 0),
            'categories': {},
            'accounts': {},
            'institutions': {}
        }
        
        # Aggregate by category
        for transaction in transactions:
            category = transaction.get('category', 'Other')
            amount = abs(transaction['amount'])
            account_id = transaction.get('account_id', 'unknown')
            account_name = transaction.get('account_name', 'Unknown Account')
            institution_name = transaction.get('institution_name', 'Unknown Institution')
            
            # Aggregate by category
            if category not in summary['categories']:
                summary['categories'][category] = {
                    'count': 0,
                    'amount': 0
                }
            summary['categories'][category]['count'] += 1
            summary['categories'][category]['amount'] += amount
            
            # Aggregate by account
            if account_id not in summary['accounts']:
                summary['accounts'][account_id] = {
                    'name': account_name,
                    'count': 0,
                    'amount': 0
                }
            summary['accounts'][account_id]['count'] += 1
            summary['accounts'][account_id]['amount'] += amount
            
            # Aggregate by institution
            if institution_name not in summary['institutions']:
                summary['institutions'][institution_name] = {
                    'count': 0,
                    'amount': 0
                }
            summary['institutions'][institution_name]['count'] += 1
            summary['institutions'][institution_name]['amount'] += amount
        
        # Use the schema to validate and format the response
        summary_schema = TransactionSummaryResponseSchema()
        result = summary_schema.dump({"data": summary})
        
        return jsonify(result)
    except Exception as e:
        logger.exception(f"Error fetching transaction summary: {str(e)}")
        return jsonify({
            'error': 'server_error',
            'message': str(e)
        }), 500

@plaid_bp.route('/plaid/test-credentials', methods=['GET'])
def test_credentials():
    """Test endpoint to verify if Plaid credentials are working."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        env = os.getenv('PLAID_ENV', 'sandbox')
        
        if not client_id or not secret:
            return jsonify({
                'valid': False,
                'error': 'Missing Plaid credentials',
                'debug': {
                    'client_id_present': bool(client_id),
                    'secret_present': bool(secret),
                    'environment': env
                }
            })
            
        # Try to call the institutions/get_by_id endpoint as a test
        payload = {
            'client_id': client_id,
            'secret': secret,
            'institution_id': 'ins_3',  # Chase Bank in sandbox
            'country_codes': ['US']
        }
        
        url = f"{get_plaid_base_url()}/institutions/get_by_id"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            institution_data = response.json().get('institution', {})
            return jsonify({
                'valid': True,
                'environment': env,
                'test_institution': {
                    'name': institution_data.get('name', 'Unknown'),
                    'id': institution_data.get('institution_id', 'Unknown')
                }
            })
        else:
            logger.error(f"Plaid API error in test_credentials: {response.text}")
            return jsonify({
                'valid': False,
                'error': 'Plaid API returned an error',
                'status_code': response.status_code,
                'details': response.text
            })
            
    except Exception as e:
        logger.exception(f"Exception in test_credentials: {str(e)}")
        return jsonify({
            'valid': False,
            'error': str(e)
        }), 500

@plaid_bp.route('/plaid/check-env', methods=['GET'])
def check_env():
    """Simple endpoint to check if Plaid environment variables are loaded correctly."""
    try:
        # Environment variables
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        env = os.getenv('PLAID_ENV', 'sandbox')
        products = os.getenv('PLAID_PRODUCTS', 'transactions').split(',')
        country_codes = os.getenv('PLAID_COUNTRY_CODES', 'US').split(',')
        
        # Read .env file
        env_file_path = 'server/.env'
        env_contents = {}
        env_exists = os.path.exists(env_file_path)
        
        if env_exists:
            with open(env_file_path, 'r') as env_file:
                for line in env_file:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_contents[key] = value
        
        # Mask the secret for security
        masked_secret = None
        if secret:
            masked_secret = secret[:4] + "*****"
        
        return jsonify({
            'env_variables': {
                'client_id_present': bool(client_id),
                'client_id_value': client_id,
                'secret_present': bool(secret),
                'secret_masked': masked_secret,
                'plaid_env': env,
                'products': products,
                'country_codes': country_codes
            },
            'env_file': {
                'exists': env_exists,
                'path': env_file_path,
                'contains_plaid_client_id': 'PLAID_CLIENT_ID' in env_contents,
                'contains_plaid_secret': 'PLAID_SECRET' in env_contents,
                'plaid_client_id_value': env_contents.get('PLAID_CLIENT_ID', 'not found').replace(env_contents.get('PLAID_CLIENT_ID', '')[4:] if env_contents.get('PLAID_CLIENT_ID') else '', '*****') if env_contents.get('PLAID_CLIENT_ID') else 'not found',
                'working_directory': os.getcwd()
            },
            'test_connection': test_plaid_credentials()
        })
    except Exception as e:
        logger.exception(f"Error in check_env: {str(e)}")
        return jsonify({
            'error': str(e),
            'working_directory': os.getcwd()
        }), 500

def test_plaid_credentials():
    """Test if Plaid credentials work by making a simple API call."""
    try:
        client_id = os.getenv('PLAID_CLIENT_ID')
        secret = os.getenv('PLAID_SECRET')
        
        if not client_id or not secret:
            return {
                'success': False,
                'message': 'Missing credentials'
            }
        
        # Try a simple API call to get institutions
        payload = {
            'client_id': client_id,
            'secret': secret,
            'count': 1,
            'country_codes': ['US']
        }
        
        url = f"{get_plaid_base_url()}/institutions/get"
        headers = {'Content-Type': 'application/json'}
        
        response = requests.post(url, headers=headers, json=payload)
        
        if response.status_code == 200:
            return {
                'success': True,
                'message': 'API call successful'
            }
        else:
            return {
                'success': False,
                'message': f"API call failed with status {response.status_code}",
                'details': response.text[:100] + '...' if len(response.text) > 100 else response.text
            }
    except Exception as e:
        return {
            'success': False,
            'message': f"Exception: {str(e)}"
        }

@plaid_bp.route('/plaid/accounts/<account_id>', methods=['DELETE'])
@require_user_id
def remove_account(account_id, user_id=None):
    """Remove a linked bank account."""
    try:
        print(f"Using user_id from decorator: {user_id}")
        
        print(f"Removing account {account_id} for user {user_id}")
        
        # First, find the account to get its plaid_item_id
        account_response = supabase.table('plaid_accounts').select('*').eq('account_id', account_id).execute()
        
        if not account_response.data or len(account_response.data) == 0:
            return jsonify({
                'error': 'account_not_found',
                'message': 'Account not found'
            }), 404
            
        account = account_response.data[0]
        plaid_item_id = account['plaid_item_id']
        
        # Delete the account
        delete_response = supabase.table('plaid_accounts').delete().eq('account_id', account_id).execute()
        
        # Check if this was the last account for this item
        remaining_accounts = supabase.table('plaid_accounts').select('*').eq('plaid_item_id', plaid_item_id).execute()
        
        # If no more accounts, also delete the plaid item
        if not remaining_accounts.data or len(remaining_accounts.data) == 0:
            supabase.table('plaid_items').delete().eq('id', plaid_item_id).execute()
            print(f"Deleted plaid item {plaid_item_id} as it had no more accounts")
        
        return jsonify({
            'success': True,
            'message': 'Account successfully removed'
        })
    except Exception as e:
        print(f"Error removing account: {str(e)}")
        return jsonify({
            'error': 'server_error',
            'message': str(e)
        }), 500

@plaid_bp.route('/transactions/cashback', methods=['GET'])
@require_user_id
def get_cashback_summary(user_id=None):
    """
    Endpoint to calculate the total cashback earned on all transactions.
    Uses the transaction data and matches accounts to rewards programs to compute cashback.
    Returns only the total cashback earned and cashback per card.
    TODO: currently hardocded for bank of america and apple card.
    """
    try:
        logger.info(f"Calculating cashback for user: {user_id}")
        
        # Get transactions data directly
        transactions, status_code = get_transactions(user_id=user_id, return_json=False)
        
        # If error occurred or no transactions, return appropriate response
        if status_code != 200 or not transactions:
            return jsonify({
                'error': 'no_transactions',
                'message': 'Failed to retrieve transactions'
            }), status_code if status_code != 200 else 404
        
        logger.info(f"Processing {len(transactions)} transactions for cashback calculation")
        
        # Get all plaid accounts for this user
        accounts_data = {}
        items_response = supabase.table('plaid_items').select('*').eq('user_id', user_id).execute()
        plaid_items = items_response.data
        
        for item in plaid_items:
            item_id = item['id']
            institution_name = item.get('institution_name', 'Financial Institution')
            
            # Get accounts for this item
            accounts_response = supabase.table('plaid_accounts').select('*').eq('plaid_item_id', item_id).execute()
            
            for account in accounts_response.data:
                accounts_data[account['account_id']] = {
                    'name': account['name'],
                    'institution_name': institution_name
                }
        
        # Calculate cashback for each transaction
        total_cashback = 0
        cashback_by_card = {}
        spending_by_card = {}
        
        for transaction in transactions:
            account_id = transaction.get('account_id')
            if not account_id or account_id not in accounts_data:
                continue
                
            institution_name = accounts_data[account_id]['institution_name']
            account_name = accounts_data[account_id]['name']
            
            # Match institution name to rewards program
            rewards_program = None
            
            # Check for Bank of America specifically
            if 'bank of america' in institution_name.lower() or 'bank of america' in account_name.lower():
                # Use the Bank of America Cash Rewards program for all Bank of America transactions
                rewards_program = REWARDS_PROGRAMS.get('Bank of America Cash Rewards')
                logger.info(f"Matched Bank of America transaction to Cash Rewards program")
            # Check for Chase specifically
            elif 'chase' in institution_name.lower() or 'chase' in account_name.lower():
                # Use the Chase Sapphire Preferred Rewards program for all Chase transactions
                rewards_program = REWARDS_PROGRAMS.get('Chase Sapphire Preferred')
                logger.info(f"Matched Chase transaction to Chase Sapphire Preferred Rewards program")
            # Check for American Express specifically
            elif 'american express' in institution_name.lower() or 'amex' in institution_name.lower() or 'american express' in account_name.lower() or 'amex' in account_name.lower():
                # Use the American Express Gold Card program for all Amex transactions
                rewards_program = REWARDS_PROGRAMS.get('American Express Gold Card')
                logger.info(f"Matched American Express transaction to Gold Card program")
            # Check for Wells Fargo specifically
            elif 'wells fargo' in institution_name.lower() or 'wells fargo' in account_name.lower():
                # Use the Wells Fargo Active Cash program for all Wells Fargo transactions
                rewards_program = REWARDS_PROGRAMS.get('Wells Fargo Active Cash')
                logger.info(f"Matched Wells Fargo transaction to Active Cash program")
            # Check for Citibank specifically
            elif 'citibank' in institution_name.lower() or 'citi' in institution_name.lower() or 'citibank' in account_name.lower() or 'citi' in account_name.lower():
                # Use the Citi Double Cash program for all Citibank transactions
                rewards_program = REWARDS_PROGRAMS.get('Citi Double Cash')
                logger.info(f"Matched Citibank transaction to Double Cash program")
            else:
                # For other institutions, try to match based on program names
                for program_name, program in REWARDS_PROGRAMS.items():
                    if program_name.lower() in institution_name.lower() or program_name.lower() in account_name.lower():
                        rewards_program = program
                        break
            
            # If no match found, skip this transaction
            if not rewards_program:
                continue
            
            # Calculate cashback for this transaction
            cashback = rewards_program.calculate_rewards(transaction)
            
            # Add to total
            total_cashback += cashback
            
            # Get transaction amount
            amount = abs(transaction['amount'])
            
            # Track by card
            card_name = rewards_program.name
            if card_name not in cashback_by_card:
                cashback_by_card[card_name] = 0
                spending_by_card[card_name] = 0
            cashback_by_card[card_name] += cashback
            spending_by_card[card_name] += amount
        
        # Format response
        result = {
            'status': 'success',
            'message': 'Cashback calculated successfully',
            'data': {
                'total_cashback': round(total_cashback, 2),
                'cashback_by_card': {k: round(v, 2) for k, v in cashback_by_card.items()},
                'spending_by_card': {k: round(v, 2) for k, v in spending_by_card.items()}
            }
        }
        
        return jsonify(result)
    except Exception as e:
        logger.exception(f"Error calculating cashback: {str(e)}")
        return jsonify({
            'error': 'server_error',
            'message': str(e)
        }), 500

@plaid_bp.route('/transactions/optimal-cashback', methods=['GET'])
@require_user_id
def get_optimal_cashback(user_id=None):
    """
    Endpoint to calculate the theoretical maximum cashback by choosing the best rewards program
    for each transaction, regardless of the actual card used.
    This helps users understand how much more they could earn by optimizing their card usage.
    """
    try:
        logger.info(f"Calculating optimal cashback for user: {user_id}")
        
        # Get transactions data directly
        transactions, status_code = get_transactions(user_id=user_id, return_json=False)
        
        # If error occurred or no transactions, return appropriate response
        if status_code != 200 or not transactions:
            return jsonify({
                'error': 'no_transactions',
                'message': 'Failed to retrieve transactions'
            }), status_code if status_code != 200 else 404
        
        logger.info(f"Processing {len(transactions)} transactions for optimal cashback calculation")
        
        # Track actual vs optimal cashback
        actual_total_cashback = 0
        optimal_total_cashback = 0
        optimal_card_usage = {}  # Which card was best for which transaction
        optimal_cashback_by_card = {}  # How much cashback each card would provide if used optimally
        optimal_spending_by_card = {}  # How much spending each card would have if used optimally
        transaction_improvements = []  # List of transactions with significant cashback improvement
        
        # Get all plaid accounts for this user for the actual cashback calculation
        accounts_data = {}
        items_response = supabase.table('plaid_items').select('*').eq('user_id', user_id).execute()
        plaid_items = items_response.data
        
        for item in plaid_items:
            item_id = item['id']
            institution_name = item.get('institution_name', 'Financial Institution')
            
            # Get accounts for this item
            accounts_response = supabase.table('plaid_accounts').select('*').eq('plaid_item_id', item_id).execute()
            
            for account in accounts_response.data:
                accounts_data[account['account_id']] = {
                    'name': account['name'],
                    'institution_name': institution_name
                }
        
        # Process each transaction
        for transaction in transactions:
            amount = abs(transaction.get('amount', 0))
            if amount <= 0:
                continue
                
            # Get actual rewards program based on the account
            actual_rewards_program = None
            actual_card_name = "Unknown Card"
            
            account_id = transaction.get('account_id')
            if account_id and account_id in accounts_data:
                institution_name = accounts_data[account_id]['institution_name']
                account_name = accounts_data[account_id]['name']
                
                # Check for Bank of America specifically
                if 'bank of america' in institution_name.lower() or 'bank of america' in account_name.lower():
                    actual_rewards_program = REWARDS_PROGRAMS.get('Bank of America Cash Rewards')
                    actual_card_name = "Bank of America Cash Rewards"
                # Check for Chase specifically
                elif 'chase' in institution_name.lower() or 'chase' in account_name.lower():
                    actual_rewards_program = REWARDS_PROGRAMS.get('Apple Card')
                    actual_card_name = "Apple Card"
                # Check for American Express specifically  
                elif 'american express' in institution_name.lower() or 'amex' in institution_name.lower() or 'american express' in account_name.lower() or 'amex' in account_name.lower():
                    actual_rewards_program = REWARDS_PROGRAMS.get('American Express Gold Card')
                    actual_card_name = "American Express Gold Card"
                # Check for Wells Fargo specifically
                elif 'wells fargo' in institution_name.lower() or 'wells fargo' in account_name.lower():
                    actual_rewards_program = REWARDS_PROGRAMS.get('Wells Fargo Active Cash')
                    actual_card_name = "Wells Fargo Active Cash"
                # Check for Citibank specifically
                elif 'citibank' in institution_name.lower() or 'citi' in institution_name.lower() or 'citibank' in account_name.lower() or 'citi' in account_name.lower():
                    actual_rewards_program = REWARDS_PROGRAMS.get('Citi Double Cash')
                    actual_card_name = "Citi Double Cash"
                else:
                    # For other institutions, try to match based on program names
                    for program_name, program in REWARDS_PROGRAMS.items():
                        if program_name.lower() in institution_name.lower() or program_name.lower() in account_name.lower():
                            actual_rewards_program = program
                            actual_card_name = program_name
                            break
            
            # Calculate actual cashback
            actual_cashback = 0
            if actual_rewards_program:
                actual_cashback = actual_rewards_program.calculate_rewards(transaction)
                actual_total_cashback += actual_cashback
            
            # Find the optimal rewards program for this transaction
            best_cashback = 0
            best_program_name = "No Card"
            
            for program_name, program in REWARDS_PROGRAMS.items():
                try:
                    cashback = program.calculate_rewards(transaction)
                    if cashback > best_cashback:
                        best_cashback = cashback
                        best_program_name = program_name
                except Exception as e:
                    logger.warning(f"Error calculating rewards for {program_name}: {e}")
            
            # Update optimal stats
            optimal_total_cashback += best_cashback
            
            if best_program_name not in optimal_cashback_by_card:
                optimal_cashback_by_card[best_program_name] = 0
                optimal_spending_by_card[best_program_name] = 0
            
            optimal_cashback_by_card[best_program_name] += best_cashback
            optimal_spending_by_card[best_program_name] += amount
            
            # Track which transactions would benefit from different cards
            cashback_improvement = best_cashback - actual_cashback
            if cashback_improvement > 0.50:  # Only track if improvement is significant (more than 50 cents)
                merchant_name = transaction.get('name', 'Unknown Merchant')
                date = transaction.get('date', '')
                
                transaction_improvements.append({
                    'date': date,
                    'merchant': merchant_name,
                    'amount': amount,
                    'actual_card': actual_card_name,
                    'actual_cashback': actual_cashback,
                    'optimal_card': best_program_name,
                    'optimal_cashback': best_cashback,
                    'improvement': cashback_improvement
                })
        
        # Sort improvements by the amount of cashback improvement (highest first)
        transaction_improvements.sort(key=lambda x: x['improvement'], reverse=True)
        
        # Limit to top 10 improvements
        top_improvements = transaction_improvements[:10]
        
        # Format response
        result = {
            'status': 'success',
            'message': 'Optimal cashback calculated successfully',
            'data': {
                'actual_total_cashback': round(actual_total_cashback, 2),
                'optimal_total_cashback': round(optimal_total_cashback, 2),
                'potential_increase': round(optimal_total_cashback - actual_total_cashback, 2),
                'improvement_percentage': round((optimal_total_cashback / actual_total_cashback - 1) * 100, 1) if actual_total_cashback > 0 else 0,
                'optimal_cashback_by_card': {k: round(v, 2) for k, v in optimal_cashback_by_card.items()},
                'optimal_spending_by_card': {k: round(v, 2) for k, v in optimal_spending_by_card.items()},
                'top_improvement_opportunities': top_improvements
            }
        }
        
        return jsonify(result)
    except Exception as e:
        logger.exception(f"Error calculating optimal cashback: {str(e)}")
        return jsonify({
            'error': 'server_error',
            'message': str(e)
        }), 500
