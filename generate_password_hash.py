#!/usr/bin/env python3
"""
Utility script to generate bcrypt password hashes for POI admin authentication.
Usage: python generate_password_hash.py [--random] [--rounds N]
"""

import getpass
import bcrypt
import sys
import argparse
import secrets
import string
import re

def validate_password_strength(password):
    """Validate password strength according to security requirements."""
    errors = []
    
    if len(password) < 8:
        errors.append("Password must be at least 8 characters long")
    
    if len(password) > 128:
        errors.append("Password must be less than 128 characters long")
    
    if not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter")
    
    if not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter")
    
    if not re.search(r'\d', password):
        errors.append("Password must contain at least one digit")
    
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        errors.append("Password must contain at least one special character")
    
    return errors

def generate_secure_random_password(length=16):
    """Generate a cryptographically secure random password."""
    # Define character sets
    lowercase = string.ascii_lowercase
    uppercase = string.ascii_uppercase
    digits = string.digits
    special = "!@#$%^&*(),.?\":{}|<>"
    
    # Ensure at least one character from each set
    password = [
        secrets.choice(lowercase),
        secrets.choice(uppercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]
    
    # Fill the rest with random characters from all sets
    all_chars = lowercase + uppercase + digits + special
    for _ in range(length - 4):
        password.append(secrets.choice(all_chars))
    
    # Shuffle the password list
    secrets.SystemRandom().shuffle(password)
    
    return ''.join(password)

def generate_password_hash(password=None, rounds=12):
    """Generate a bcrypt hash for a password."""
    
    print("POI Admin Password Hash Generator")
    print("=" * 40)
    
    try:
        if password is None:
            # Get password from user
            password = getpass.getpass("Enter admin password: ")
            confirm_password = getpass.getpass("Confirm password: ")
            
            if password != confirm_password:
                print("ERROR: Passwords do not match!")
                return False
        
        # Validate password strength
        validation_errors = validate_password_strength(password)
        if validation_errors:
            print("ERROR: Password does not meet security requirements:")
            for error in validation_errors:
                print(f"  - {error}")
            return False
        
        # Generate hash
        password_hash = bcrypt.hashpw(
            password.encode('utf-8'), 
            bcrypt.gensalt(rounds=rounds)
        ).decode('utf-8')
        
        print("\nGenerated password hash:")
        print("-" * 40)
        print(password_hash)
        print("-" * 40)
        
        print("\nTo use this hash, add the following to your .env file:")
        print(f"POI_ADMIN_PASSWORD_HASH={password_hash}")
        
        if password != getpass.getpass(""):  # Only show if not from stdin
            print(f"\nIMPORTANT: Save your password securely: {password}")
        
        return True
        
    except KeyboardInterrupt:
        print("\nOperation cancelled.")
        return False
    except Exception as e:
        print(f"ERROR: {e}")
        return False

def main():
    """Main function with command line argument parsing."""
    parser = argparse.ArgumentParser(
        description="Generate bcrypt password hashes for POI admin authentication"
    )
    parser.add_argument(
        '--random', 
        action='store_true',
        help='Generate a secure random password instead of prompting'
    )
    parser.add_argument(
        '--rounds', 
        type=int, 
        default=12,
        help='Number of bcrypt rounds (default: 12, min: 10, max: 15)'
    )
    parser.add_argument(
        '--length',
        type=int,
        default=16,
        help='Length of random password (default: 16, min: 12, max: 64)'
    )
    
    args = parser.parse_args()
    
    # Validate rounds
    if args.rounds < 10 or args.rounds > 15:
        print("ERROR: bcrypt rounds must be between 10 and 15")
        return False
    
    # Validate length for random passwords
    if args.random and (args.length < 12 or args.length > 64):
        print("ERROR: Random password length must be between 12 and 64")
        return False
    
    if args.random:
        # Generate random password
        password = generate_secure_random_password(args.length)
        print(f"Generated secure random password: {password}")
        print("IMPORTANT: Save this password securely - it will not be shown again!")
        print()
        return generate_password_hash(password, args.rounds)
    else:
        # Interactive password entry
        return generate_password_hash(rounds=args.rounds)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)