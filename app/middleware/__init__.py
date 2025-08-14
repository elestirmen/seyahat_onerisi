"""Middleware package for POI Travel Recommendation API."""

from .error_handler import ErrorHandler, error_handler, APIError
from .error_handler import bad_request, unauthorized, forbidden, not_found, conflict, rate_limit_exceeded, internal_error

__all__ = [
    'ErrorHandler', 'error_handler', 'APIError',
    'bad_request', 'unauthorized', 'forbidden', 'not_found', 
    'conflict', 'rate_limit_exceeded', 'internal_error'
]
