"""
Main routes for POI Travel Recommendation API.
Handles home page and basic application routes.
"""

from flask import Blueprint, render_template, current_app
import logging

logger = logging.getLogger(__name__)

# Create Main blueprint
main_bp = Blueprint('main', __name__)


@main_bp.route('/', methods=['GET'])
def index():
    """
    Home page route.
    
    Returns:
        Rendered home page template
    """
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error rendering home page: {e}")
        return "Ana sayfa yüklenirken hata oluştu", 500


@main_bp.route('/about', methods=['GET'])
def about():
    """
    About page route.
    
    Returns:
        Rendered about page template
    """
    try:
        return render_template('about.html')
    except Exception as e:
        logger.error(f"Error rendering about page: {e}")
        return "Hakkında sayfası yüklenirken hata oluştu", 500


@main_bp.route('/contact', methods=['GET'])
def contact():
    """
    Contact page route.
    
    Returns:
        Rendered contact page template
    """
    try:
        return render_template('contact.html')
    except Exception as e:
        logger.error(f"Error rendering contact page: {e}")
        return "İletişim sayfası yüklenirken hata oluştu", 500