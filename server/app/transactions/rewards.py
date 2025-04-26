# Rewards Program Interface
class RewardsProgram:
    def __init__(self, name, rules):
        self.name = name
        self.rules = rules

    def calculate_rewards(self, transaction):
        raise NotImplementedError("Subclasses must implement calculate_rewards")

class AppleCardRewards(RewardsProgram):
    def __init__(self):
        super().__init__("Apple Card", {
            "select_merchants": 0.03,  # 3% on select merchants
            "apple_pay": 0.02,        # 2% on Apple Pay
            "other": 0.01             # 1% on all other purchases
        })
        self.select_merchants = ["Apple", "Nike", "Lyft"]

    def calculate_rewards(self, transaction):
        amount = abs(transaction['amount'])
        merchant_name = transaction.get('merchant_name', '') or ''
        payment_channel = transaction.get('payment_channel', '')
        
        # Check if transaction is with select merchants (3%)
        if any(merchant.lower() in merchant_name.lower() for merchant in self.select_merchants):
            return amount * self.rules["select_merchants"]
        
        # Check if payment made with Apple Pay (2%)
        # Note: This is simplified as Plaid may not provide this information directly
        elif payment_channel == "apple_pay":
            return amount * self.rules["apple_pay"]
        
        # Default reward rate (1%)
        return amount * self.rules["other"]

class BankOfAmericaCashRewards(RewardsProgram):
    def __init__(self):
        super().__init__("Bank of America Cash Rewards", {
            "all_purchases": 0.015  # 1.5% on all purchases
        })

    def calculate_rewards(self, transaction):
        amount = abs(transaction['amount'])
        return amount * self.rules["all_purchases"]

class BankOfAmericaCustomizedCashRewards(RewardsProgram):
    def __init__(self):
        super().__init__("Bank of America Customized Cash Rewards", {
            "category_choice": 0.03,  # 3% on category of choice
            "grocery_wholesale": 0.02,  # 2% on grocery and wholesale
            "other": 0.01  # 1% on other purchases
        })
        self.quarterly_spend = 0
        self.quarterly_limit = 2500

    def calculate_rewards(self, transaction):
        amount = abs(transaction['amount'])
        # Simplified version - would need to check categories and track quarterly spend
        if self.quarterly_spend + amount <= self.quarterly_limit:
            self.quarterly_spend += amount
            return amount * self.rules["category_choice"]
        return amount * self.rules["other"]

class DiscoverItStudentCashBack(RewardsProgram):
    def __init__(self):
        super().__init__("Discover It Student Cash Back", {
            "quarterly_category": 0.05,  # 5% on quarterly categories
            "other": 0.01  # 1% on other purchases
        })
        self.quarterly_spend = 0
        self.quarterly_limit = 1500
        self.quarterly_cashback_limit = 75
        self.current_quarter_category = "Grocery Stores and Wholesale Clubs"  # April-June 2025

    def calculate_rewards(self, transaction):
        amount = abs(transaction['amount'])
        # Simplified version - would need to check categories and track quarterly spend
        if self.quarterly_spend + amount <= self.quarterly_limit:
            self.quarterly_spend += amount
            rewards = amount * self.rules["quarterly_category"]
            if rewards > self.quarterly_cashback_limit:
                rewards = self.quarterly_cashback_limit
            return rewards
        return amount * self.rules["other"]

class ChaseSapphirePreferred(RewardsProgram):
    def __init__(self):
        super().__init__("Chase Sapphire Preferred", {
            "dining": 0.03,           # 3x points on dining
            "online_grocery": 0.03,   # 3x points on online grocery
            "streaming": 0.03,        # 3x points on select streaming services
            "travel": 0.05,           # 5x points on travel purchased through Chase
            "other_travel": 0.02,     # 2x points on other travel purchases
            "other": 0.01             # 1x points on other purchases
        })
        self.dining_categories = ["Food and Drink", "Restaurants", "Fast Food"]
        self.streaming_services = ["Netflix", "Spotify", "Disney+", "HBO", "Hulu", "Amazon Prime"]
        self.travel_merchants = ["Chase Travel", "Chase Ultimate Rewards"]

    def calculate_rewards(self, transaction):
        amount = abs(transaction['amount'])
        category = transaction.get('category', '')
        merchant_name = transaction.get('merchant_name', '') or ''
        
        # Check if transaction is travel through Chase (5x)
        if any(merchant.lower() in merchant_name.lower() for merchant in self.travel_merchants):
            return amount * self.rules["travel"]
        
        # Check if transaction is dining (3x)
        elif any(cat.lower() in category.lower() for cat in self.dining_categories):
            return amount * self.rules["dining"]
        
        # Check if transaction is for streaming services (3x)
        elif any(service.lower() in merchant_name.lower() for service in self.streaming_services):
            return amount * self.rules["streaming"]
        
        # Check if transaction is online grocery (3x)
        elif "Groceries" in category and "online" in merchant_name.lower():
            return amount * self.rules["online_grocery"]
        
        # Check if transaction is other travel (2x)
        elif "Travel" in category or "Airlines" in category or "Hotel" in category:
            return amount * self.rules["other_travel"]
        
        # Default reward rate (1x)
        return amount * self.rules["other"]

# Map of account names to rewards programs
REWARDS_PROGRAMS = {
    "Apple Card": AppleCardRewards(),
    "Bank of America Cash Rewards": BankOfAmericaCashRewards(),
    "Bank of America Customized Cash Rewards": BankOfAmericaCustomizedCashRewards(),
    "Discover It Student Cash Back": DiscoverItStudentCashBack(),
    "Chase Sapphire Preferred": ChaseSapphirePreferred()
}
