#!/usr/bin/env python3
"""Test script to verify imports work correctly."""
import sys
sys.path.insert(0, '/home/rehaan/projects/claude_project/saas/backend')

try:
    print("Importing app.tokens...")
    from app import tokens
    print(f"✓ tokens module imported: {tokens.__file__}")
    
    print("\nImporting app.auth...")
    from app import auth
    print(f"✓ auth module imported: {auth.__file__}")
    
    print("\nImporting app.dependencies...")
    from app import dependencies
    print(f"✓ dependencies module imported: {dependencies.__file__}")
    
    print("\nImporting main.app...")
    from main import app
    print(f"✓ main.app imported successfully")
    print("\n✅ All imports successful!")
    
except Exception as e:
    print(f"\n❌ Import failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
