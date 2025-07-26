#!/usr/bin/env python3
"""
Authentication setup script for POI management system.
Handles initial configuration, validation, and environment setup.

Usage:
    python setup_authentication.py --auto          # Automatic setup with defaults
    python setup_authentication.py --interactive   # Interactive setup
    python setup_authentication.py --validate      # Validate existing configuration
    python setup_authentication.py --reset         # Reset authentication configuration
"""

import os
import sys
import argparse
import secrets
import bcrypt
import getpass
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple

class AuthenticationSetup:
    """Authentication setup and configuration manager."""
    
    def __init__(self):
        self.env_file = Path('.env')
        self.env_example = Path('.env.example')
        self.config_backup = Path('.env.backup')
        
        # Default configuration values
        self.defaults = {
            'POI_SESSION_TIMEOUT': '7200',
            'POI_REMEMBER_TIMEOUT': '604800',
            'POI_MAX_LOGIN_ATTEMPTS': '5',
            'POI_LOCKOUT_DURATION': '900',
            'POI_BCRYPT_ROUNDS': '12',
            'POI_SESSION_SECURE': 'True'
        }
        
        # Configuration validation rules
        self.validation_rules = {
            'POI_SESSION_TIMEOUT': {'min': 300, 'max': 86400, 'type': int},
            'POI_REMEMBER_TIMEOUT': {'min': 3600, 'max': 2592000, 'type': int},
            'POI_MAX_LOGIN_ATTEMPTS': {'min': 3, 'max': 10, 'type': int},
            'POI_LOCKOUT_DURATION': {'min': 300, 'max': 3600, 'type': int},
            'POI_BCRYPT_ROUNDS': {'min': 10, 'max': 15, 'type': int},
            'POI_SESSION_SECURE': {'values': ['True', 'False'], 'type': str}
        }
    
    def print_header(self, title: str):
        """Print a formatted header."""
        print("\n" + "=" * 60)
        print(f" {title}")
        print("=" * 60)
    
    def print_step(self, step: str, description: str):
        """Print a formatted step."""
        print(f"\n[{step}] {description}")
        print("-" * 40)
    
    def generate_secure_password(self, length: int = 16) -> str:
        """Generate a cryptographically secure password."""
        import string
        
        # Character sets
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
        
        # Fill the rest
        all_chars = lowercase + uppercase + digits + special
        for _ in range(length - 4):
            password.append(secrets.choice(all_chars))
        
        # Shuffle
        secrets.SystemRandom().shuffle(password)
        return ''.join(password)
    
    def generate_password_hash(self, password: str, rounds: int = 12) -> str:
        """Generate bcrypt hash for password."""
        return bcrypt.hashpw(
            password.encode('utf-8'),
            bcrypt.gensalt(rounds=rounds)
        ).decode('utf-8')
    
    def load_env_file(self) -> Dict[str, str]:
        """Load environment variables from .env file."""
        env_vars = {}
        
        if self.env_file.exists():
            with open(self.env_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        key, value = line.split('=', 1)
                        env_vars[key.strip()] = value.strip()
        
        return env_vars
    
    def save_env_file(self, env_vars: Dict[str, str]):
        """Save environment variables to .env file."""
        # Create backup if file exists
        if self.env_file.exists():
            shutil.copy2(self.env_file, self.config_backup)
            print(f"✓ Backup created: {self.config_backup}")
        
        # Write new configuration
        with open(self.env_file, 'w', encoding='utf-8') as f:
            f.write("# POI Yönetim Sistemi - Çevre Değişkenleri\n")
            f.write("# Bu dosya setup_authentication.py tarafından oluşturulmuştur\n\n")
            
            # Group related variables
            groups = {
                'Database': ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'],
                'API': ['API_HOST', 'API_PORT', 'DEBUG'],
                'Authentication': [
                    'POI_SESSION_SECRET_KEY', 'POI_ADMIN_PASSWORD_HASH',
                    'POI_SESSION_TIMEOUT', 'POI_REMEMBER_TIMEOUT',
                    'POI_MAX_LOGIN_ATTEMPTS', 'POI_LOCKOUT_DURATION',
                    'POI_BCRYPT_ROUNDS', 'POI_SESSION_SECURE'
                ],
                'Security': ['SECRET_KEY', 'ALLOWED_HOSTS'],
                'Other': []
            }
            
            # Write grouped variables
            for group_name, group_vars in groups.items():
                if group_name != 'Other':
                    group_found = False
                    for var in group_vars:
                        if var in env_vars:
                            if not group_found:
                                f.write(f"# {group_name} Configuration\n")
                                group_found = True
                            f.write(f"{var}={env_vars[var]}\n")
                    if group_found:
                        f.write("\n")
            
            # Write remaining variables
            other_vars = []
            for key, value in env_vars.items():
                found_in_group = False
                for group_vars in groups.values():
                    if key in group_vars:
                        found_in_group = True
                        break
                if not found_in_group:
                    other_vars.append((key, value))
            
            if other_vars:
                f.write("# Other Configuration\n")
                for key, value in other_vars:
                    f.write(f"{key}={value}\n")
        
        print(f"✓ Configuration saved: {self.env_file}")
    
    def validate_configuration(self, env_vars: Dict[str, str]) -> Tuple[bool, List[str]]:
        """Validate authentication configuration."""
        errors = []
        
        # Check required variables
        required_vars = ['POI_SESSION_SECRET_KEY', 'POI_ADMIN_PASSWORD_HASH']
        for var in required_vars:
            if var not in env_vars or not env_vars[var]:
                errors.append(f"Missing required variable: {var}")
        
        # Validate variable values
        for var, rules in self.validation_rules.items():
            if var in env_vars and env_vars[var]:
                value = env_vars[var]
                
                # Type validation
                if rules['type'] == int:
                    try:
                        int_value = int(value)
                        if 'min' in rules and int_value < rules['min']:
                            errors.append(f"{var} must be at least {rules['min']}")
                        if 'max' in rules and int_value > rules['max']:
                            errors.append(f"{var} must be at most {rules['max']}")
                    except ValueError:
                        errors.append(f"{var} must be a valid integer")
                
                elif rules['type'] == str and 'values' in rules:
                    if value not in rules['values']:
                        errors.append(f"{var} must be one of: {', '.join(rules['values'])}")
        
        # Validate password hash format
        if 'POI_ADMIN_PASSWORD_HASH' in env_vars:
            hash_value = env_vars['POI_ADMIN_PASSWORD_HASH']
            if not hash_value.startswith('$2b$'):
                errors.append("POI_ADMIN_PASSWORD_HASH must be a valid bcrypt hash")
        
        # Validate secret key length
        if 'POI_SESSION_SECRET_KEY' in env_vars:
            secret_key = env_vars['POI_SESSION_SECRET_KEY']
            if len(secret_key) < 32:
                errors.append("POI_SESSION_SECRET_KEY must be at least 32 characters long")
        
        return len(errors) == 0, errors
    
    def auto_setup(self) -> bool:
        """Perform automatic setup with secure defaults."""
        self.print_header("Automatic Authentication Setup")
        
        # Load existing configuration
        env_vars = self.load_env_file()
        
        # Copy from example if .env doesn't exist
        if not self.env_file.exists() and self.env_example.exists():
            self.print_step("1", "Copying configuration from example file")
            with open(self.env_example, 'r', encoding='utf-8') as f:
                example_content = f.read()
            
            # Parse example file
            for line in example_content.split('\n'):
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    key = key.strip()
                    value = value.strip()
                    if key not in env_vars:
                        env_vars[key] = value
            
            print("✓ Base configuration loaded from example")
        
        # Generate session secret key
        self.print_step("2", "Generating session secret key")
        if 'POI_SESSION_SECRET_KEY' not in env_vars or not env_vars['POI_SESSION_SECRET_KEY']:
            env_vars['POI_SESSION_SECRET_KEY'] = secrets.token_hex(32)
            print("✓ Session secret key generated")
        else:
            print("✓ Using existing session secret key")
        
        # Generate admin password
        self.print_step("3", "Generating admin password")
        if 'POI_ADMIN_PASSWORD_HASH' not in env_vars or not env_vars['POI_ADMIN_PASSWORD_HASH']:
            password = self.generate_secure_password(16)
            rounds = int(env_vars.get('POI_BCRYPT_ROUNDS', '12'))
            password_hash = self.generate_password_hash(password, rounds)
            env_vars['POI_ADMIN_PASSWORD_HASH'] = password_hash
            
            print("✓ Admin password generated")
            print(f"  Password: {password}")
            print("  IMPORTANT: Save this password securely!")
        else:
            print("✓ Using existing admin password hash")
        
        # Set default values
        self.print_step("4", "Setting default configuration values")
        for key, default_value in self.defaults.items():
            if key not in env_vars or not env_vars[key]:
                env_vars[key] = default_value
                print(f"✓ Set {key} = {default_value}")
        
        # Validate configuration
        self.print_step("5", "Validating configuration")
        is_valid, errors = self.validate_configuration(env_vars)
        
        if not is_valid:
            print("✗ Configuration validation failed:")
            for error in errors:
                print(f"  - {error}")
            return False
        
        print("✓ Configuration validation passed")
        
        # Save configuration
        self.print_step("6", "Saving configuration")
        self.save_env_file(env_vars)
        
        print("\n✓ Automatic setup completed successfully!")
        print("\nNext steps:")
        print("1. Review the generated .env file")
        print("2. Save the admin password securely")
        print("3. Start the POI API server")
        
        return True
    
    def interactive_setup(self) -> bool:
        """Perform interactive setup with user input."""
        self.print_header("Interactive Authentication Setup")
        
        # Load existing configuration
        env_vars = self.load_env_file()
        
        # Session secret key
        self.print_step("1", "Session Secret Key Configuration")
        if 'POI_SESSION_SECRET_KEY' in env_vars and env_vars['POI_SESSION_SECRET_KEY']:
            print(f"Current: {env_vars['POI_SESSION_SECRET_KEY'][:16]}...")
            if input("Generate new session secret key? (y/N): ").lower().startswith('y'):
                env_vars['POI_SESSION_SECRET_KEY'] = secrets.token_hex(32)
                print("✓ New session secret key generated")
        else:
            env_vars['POI_SESSION_SECRET_KEY'] = secrets.token_hex(32)
            print("✓ Session secret key generated")
        
        # Admin password
        self.print_step("2", "Admin Password Configuration")
        if 'POI_ADMIN_PASSWORD_HASH' in env_vars and env_vars['POI_ADMIN_PASSWORD_HASH']:
            print("Current password hash exists")
            if input("Set new admin password? (y/N): ").lower().startswith('y'):
                self._interactive_password_setup(env_vars)
        else:
            self._interactive_password_setup(env_vars)
        
        # Configuration values
        self.print_step("3", "Security Configuration")
        for key, default_value in self.defaults.items():
            current_value = env_vars.get(key, default_value)
            print(f"\n{key}:")
            print(f"  Current: {current_value}")
            
            if key in self.validation_rules:
                rules = self.validation_rules[key]
                if 'min' in rules and 'max' in rules:
                    print(f"  Range: {rules['min']} - {rules['max']}")
                elif 'values' in rules:
                    print(f"  Options: {', '.join(rules['values'])}")
            
            new_value = input(f"  New value (Enter to keep current): ").strip()
            if new_value:
                env_vars[key] = new_value
        
        # Validate configuration
        self.print_step("4", "Validating Configuration")
        is_valid, errors = self.validate_configuration(env_vars)
        
        if not is_valid:
            print("✗ Configuration validation failed:")
            for error in errors:
                print(f"  - {error}")
            
            if input("\nSave configuration anyway? (y/N): ").lower().startswith('y'):
                print("⚠ Saving invalid configuration - please fix errors manually")
            else:
                print("Setup cancelled")
                return False
        else:
            print("✓ Configuration validation passed")
        
        # Save configuration
        self.print_step("5", "Saving Configuration")
        self.save_env_file(env_vars)
        
        print("\n✓ Interactive setup completed!")
        return True
    
    def _interactive_password_setup(self, env_vars: Dict[str, str]):
        """Handle interactive password setup."""
        print("\nPassword options:")
        print("1. Generate secure random password")
        print("2. Enter custom password")
        
        choice = input("Choose option (1-2): ").strip()
        
        if choice == '1':
            length = input("Password length (12-64, default 16): ").strip()
            try:
                length = int(length) if length else 16
                if length < 12 or length > 64:
                    print("Invalid length, using default (16)")
                    length = 16
            except ValueError:
                length = 16
            
            password = self.generate_secure_password(length)
            print(f"Generated password: {password}")
            print("IMPORTANT: Save this password securely!")
        
        elif choice == '2':
            while True:
                password = getpass.getpass("Enter admin password: ")
                confirm = getpass.getpass("Confirm password: ")
                
                if password != confirm:
                    print("Passwords do not match, try again")
                    continue
                
                if len(password) < 8:
                    print("Password must be at least 8 characters long")
                    continue
                
                break
        
        else:
            print("Invalid choice, generating random password")
            password = self.generate_secure_password(16)
            print(f"Generated password: {password}")
        
        # Generate hash
        rounds = int(env_vars.get('POI_BCRYPT_ROUNDS', '12'))
        password_hash = self.generate_password_hash(password, rounds)
        env_vars['POI_ADMIN_PASSWORD_HASH'] = password_hash
        print("✓ Password hash generated")
    
    def validate_existing(self) -> bool:
        """Validate existing configuration."""
        self.print_header("Configuration Validation")
        
        if not self.env_file.exists():
            print("✗ No .env file found")
            print("Run setup with --auto or --interactive to create configuration")
            return False
        
        env_vars = self.load_env_file()
        is_valid, errors = self.validate_configuration(env_vars)
        
        if is_valid:
            print("✓ Configuration is valid")
            
            # Show configuration summary
            print("\nConfiguration Summary:")
            auth_vars = [k for k in env_vars.keys() if k.startswith('POI_')]
            for var in sorted(auth_vars):
                if 'PASSWORD' in var or 'SECRET' in var:
                    print(f"  {var}: [HIDDEN]")
                else:
                    print(f"  {var}: {env_vars[var]}")
            
            return True
        else:
            print("✗ Configuration validation failed:")
            for error in errors:
                print(f"  - {error}")
            
            print("\nTo fix these issues:")
            print("1. Edit the .env file manually, or")
            print("2. Run setup again with --interactive")
            
            return False
    
    def reset_configuration(self) -> bool:
        """Reset authentication configuration."""
        self.print_header("Reset Authentication Configuration")
        
        print("⚠ WARNING: This will reset all authentication settings!")
        print("Current configuration will be backed up.")
        
        if not input("Are you sure? Type 'yes' to continue: ").lower() == 'yes':
            print("Reset cancelled")
            return False
        
        # Create backup
        if self.env_file.exists():
            backup_name = f".env.backup.{secrets.token_hex(4)}"
            shutil.copy2(self.env_file, backup_name)
            print(f"✓ Backup created: {backup_name}")
        
        # Load non-auth variables
        env_vars = self.load_env_file()
        auth_vars = [k for k in env_vars.keys() if k.startswith('POI_')]
        
        # Remove auth variables
        for var in auth_vars:
            del env_vars[var]
        
        # Save cleaned configuration
        self.save_env_file(env_vars)
        
        print("✓ Authentication configuration reset")
        print("Run setup with --auto or --interactive to reconfigure")
        
        return True

def main():
    """Main function with command line argument parsing."""
    parser = argparse.ArgumentParser(
        description="POI Authentication Setup Script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python setup_authentication.py --auto          # Quick automatic setup
  python setup_authentication.py --interactive   # Step-by-step setup
  python setup_authentication.py --validate      # Check current config
  python setup_authentication.py --reset         # Reset configuration
        """
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--auto', action='store_true',
                      help='Automatic setup with secure defaults')
    group.add_argument('--interactive', action='store_true',
                      help='Interactive setup with user prompts')
    group.add_argument('--validate', action='store_true',
                      help='Validate existing configuration')
    group.add_argument('--reset', action='store_true',
                      help='Reset authentication configuration')
    
    args = parser.parse_args()
    
    setup = AuthenticationSetup()
    
    try:
        if args.auto:
            success = setup.auto_setup()
        elif args.interactive:
            success = setup.interactive_setup()
        elif args.validate:
            success = setup.validate_existing()
        elif args.reset:
            success = setup.reset_configuration()
        
        sys.exit(0 if success else 1)
        
    except KeyboardInterrupt:
        print("\n\nSetup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nERROR: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()