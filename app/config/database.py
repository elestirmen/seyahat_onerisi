"""
Database configuration and connection management for POI Travel Recommendation API.
PostgreSQL connection pooling with health checks and failover.
"""

import psycopg2
import psycopg2.pool
from psycopg2.extras import RealDictCursor
import logging
import time
from contextlib import contextmanager
from typing import Optional, Generator, Any
import threading

logger = logging.getLogger(__name__)


class DatabasePool:
    """PostgreSQL connection pool manager with health monitoring."""
    
    def __init__(self, config):
        """
        Initialize database pool with configuration.
        
        Args:
            config: Flask configuration object with database settings
        """
        self.config = config
        self.pool = None
        self.pool_lock = threading.Lock()
        self.health_check_query = "SELECT 1"
        self.max_retries = 3
        self.retry_delay = 1  # seconds
        
        # Pool configuration
        self.min_connections = 1
        self.max_connections = config.DB_POOL_SIZE
        self.connection_timeout = config.DB_TIMEOUT
        
        self._initialize_pool()
    
    def _initialize_pool(self):
        """Initialize the connection pool."""
        try:
            connection_params = {
                'host': self.config.DB_HOST,
                'port': self.config.DB_PORT,
                'database': self.config.DB_NAME,
                'user': self.config.DB_USER,
                'password': self.config.DB_PASSWORD,
                'cursor_factory': RealDictCursor,
                'connect_timeout': self.connection_timeout
            }
            
            self.pool = psycopg2.pool.ThreadedConnectionPool(
                minconn=self.min_connections,
                maxconn=self.max_connections,
                **connection_params
            )
            
            logger.info(f"Database pool initialized: {self.min_connections}-{self.max_connections} connections")
            
            # Test initial connection
            if self._test_connection():
                logger.info("Database pool health check passed")
            else:
                logger.warning("Database pool health check failed")
                
        except Exception as e:
            logger.error(f"Failed to initialize database pool: {e}")
            self.pool = None
    
    def _test_connection(self) -> bool:
        """Test database connectivity."""
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    cursor.execute(self.health_check_query)
                    cursor.fetchone()
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False
    
    @contextmanager
    def get_connection(self) -> Generator[Any, None, None]:
        """
        Get a database connection from the pool.
        
        Yields:
            Database connection with automatic cleanup
        """
        if not self.pool:
            raise ConnectionError("Database pool not initialized")
        
        connection = None
        retries = 0
        
        try:
            while retries < self.max_retries:
                try:
                    with self.pool_lock:
                        connection = self.pool.getconn()
                    
                    if connection:
                        # Test connection before yielding
                        with connection.cursor() as test_cursor:
                            test_cursor.execute(self.health_check_query)
                            test_cursor.fetchone()
                        
                        yield connection
                        break
                    else:
                        raise ConnectionError("No connection available from pool")
                        
                except Exception as e:
                    logger.warning(f"Database connection attempt {retries + 1} failed: {e}")
                    
                    if connection:
                        try:
                            with self.pool_lock:
                                self.pool.putconn(connection, close=True)
                        except Exception:
                            pass
                        connection = None
                    
                    retries += 1
                    if retries < self.max_retries:
                        time.sleep(self.retry_delay * retries)  # Exponential backoff
                    else:
                        raise ConnectionError(f"Failed to get database connection after {self.max_retries} attempts")
        
        finally:
            if connection:
                try:
                    with self.pool_lock:
                        self.pool.putconn(connection)
                except Exception as e:
                    logger.error(f"Error returning connection to pool: {e}")
    
    def health_check(self) -> dict:
        """
        Perform comprehensive database health check.
        
        Returns:
            dict: Health status information
        """
        start_time = time.time()
        
        try:
            with self.get_connection() as conn:
                with conn.cursor() as cursor:
                    # Basic connectivity test
                    cursor.execute(self.health_check_query)
                    cursor.fetchone()
                    
                    # Pool status
                    pool_info = {
                        'total_connections': self.max_connections,
                        'min_connections': self.min_connections,
                        'available': True
                    }
                    
                    response_time = time.time() - start_time
                    
                    return {
                        'status': 'healthy',
                        'response_time_ms': round(response_time * 1000, 2),
                        'pool': pool_info,
                        'database': {
                            'host': self.config.DB_HOST,
                            'port': self.config.DB_PORT,
                            'name': self.config.DB_NAME
                        }
                    }
                    
        except Exception as e:
            response_time = time.time() - start_time
            logger.error(f"Database health check failed: {e}")
            
            return {
                'status': 'unhealthy',
                'error': str(e),
                'response_time_ms': round(response_time * 1000, 2),
                'pool': {
                    'available': False
                }
            }
    
    def close_all_connections(self):
        """Close all connections in the pool."""
        if self.pool:
            try:
                with self.pool_lock:
                    self.pool.closeall()
                logger.info("All database connections closed")
            except Exception as e:
                logger.error(f"Error closing database connections: {e}")
    
    def get_pool_stats(self) -> dict:
        """Get connection pool statistics."""
        if not self.pool:
            return {'status': 'not_initialized'}
        
        try:
            # Note: psycopg2 pool doesn't expose detailed stats
            # This is a basic implementation
            return {
                'min_connections': self.min_connections,
                'max_connections': self.max_connections,
                'pool_initialized': True,
                'last_health_check': time.time()
            }
        except Exception as e:
            logger.error(f"Error getting pool stats: {e}")
            return {'status': 'error', 'error': str(e)}


# Global database pool instance
_db_pool: Optional[DatabasePool] = None


def init_database_pool(config) -> DatabasePool:
    """
    Initialize global database pool.
    
    Args:
        config: Flask configuration object
        
    Returns:
        DatabasePool: Initialized database pool
    """
    global _db_pool
    
    if _db_pool is None:
        _db_pool = DatabasePool(config)
        logger.info("Global database pool initialized")
    
    return _db_pool


def get_database_pool() -> Optional[DatabasePool]:
    """
    Get the global database pool instance.
    
    Returns:
        DatabasePool or None: Current database pool
    """
    return _db_pool


def get_db_connection():
    """
    Get database connection (compatibility function).
    
    Returns:
        Database connection context manager
    """
    if _db_pool is None:
        raise ConnectionError("Database pool not initialized")
    
    return _db_pool.get_connection()


def database_health_check() -> dict:
    """
    Perform database health check (compatibility function).
    
    Returns:
        dict: Health check results
    """
    if _db_pool is None:
        return {
            'status': 'unhealthy',
            'error': 'Database pool not initialized'
        }
    
    return _db_pool.health_check()


def close_database_pool():
    """Close the global database pool."""
    global _db_pool
    
    if _db_pool:
        _db_pool.close_all_connections()
        _db_pool = None
        logger.info("Global database pool closed")
