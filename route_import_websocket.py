#!/usr/bin/env python3
"""
WebSocket endpoint for real-time route import progress tracking
"""

from flask import Flask
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
import json
import time
import threading
from datetime import datetime
from auth_middleware import auth_middleware

# Create Flask app for WebSocket
websocket_app = Flask(__name__)
websocket_app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(websocket_app, origins=["*"], supports_credentials=True)

# Initialize SocketIO
socketio = SocketIO(websocket_app, cors_allowed_origins="*", async_mode='threading')

# Global progress tracking (shared with main API)
import poi_api
progress_tracker = poi_api.upload_progress
progress_lock = poi_api.upload_progress_lock

# Connected clients tracking
connected_clients = {}
clients_lock = threading.Lock()


@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    
    with clients_lock:
        connected_clients[request.sid] = {
            'connected_at': datetime.now().isoformat(),
            'subscribed_uploads': set()
        }
    
    emit('connection_status', {
        'status': 'connected',
        'message': 'WebSocket bağlantısı kuruldu',
        'timestamp': datetime.now().isoformat()
    })


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")
    
    with clients_lock:
        if request.sid in connected_clients:
            del connected_clients[request.sid]


@socketio.on('subscribe_upload')
def handle_subscribe_upload(data):
    """
    Subscribe to upload progress updates
    
    Expected data:
    {
        "upload_id": "uuid"
    }
    """
    try:
        upload_id = data.get('upload_id')
        if not upload_id:
            emit('error', {
                'error': 'Upload ID gerekli',
                'error_code': 'MISSING_UPLOAD_ID'
            })
            return
        
        # Join room for this upload
        join_room(f"upload_{upload_id}")
        
        # Track subscription
        with clients_lock:
            if request.sid in connected_clients:
                connected_clients[request.sid]['subscribed_uploads'].add(upload_id)
        
        # Send current progress if available
        with progress_lock:
            current_progress = progress_tracker.get(upload_id)
        
        if current_progress:
            emit('upload_progress', {
                'upload_id': upload_id,
                'progress': current_progress
            })
        
        emit('subscription_confirmed', {
            'upload_id': upload_id,
            'message': f'Upload {upload_id} takibine başlandı'
        })
        
    except Exception as e:
        emit('error', {
            'error': f'Subscription hatası: {str(e)}',
            'error_code': 'SUBSCRIPTION_ERROR'
        })


@socketio.on('unsubscribe_upload')
def handle_unsubscribe_upload(data):
    """
    Unsubscribe from upload progress updates
    
    Expected data:
    {
        "upload_id": "uuid"
    }
    """
    try:
        upload_id = data.get('upload_id')
        if not upload_id:
            emit('error', {
                'error': 'Upload ID gerekli',
                'error_code': 'MISSING_UPLOAD_ID'
            })
            return
        
        # Leave room for this upload
        leave_room(f"upload_{upload_id}")
        
        # Remove from subscription tracking
        with clients_lock:
            if request.sid in connected_clients:
                connected_clients[request.sid]['subscribed_uploads'].discard(upload_id)
        
        emit('unsubscription_confirmed', {
            'upload_id': upload_id,
            'message': f'Upload {upload_id} takibi durduruldu'
        })
        
    except Exception as e:
        emit('error', {
            'error': f'Unsubscription hatası: {str(e)}',
            'error_code': 'UNSUBSCRIPTION_ERROR'
        })


@socketio.on('get_upload_status')
def handle_get_upload_status(data):
    """
    Get current status of an upload
    
    Expected data:
    {
        "upload_id": "uuid"
    }
    """
    try:
        upload_id = data.get('upload_id')
        if not upload_id:
            emit('error', {
                'error': 'Upload ID gerekli',
                'error_code': 'MISSING_UPLOAD_ID'
            })
            return
        
        with progress_lock:
            progress_info = progress_tracker.get(upload_id)
        
        if progress_info:
            emit('upload_status', {
                'upload_id': upload_id,
                'progress': progress_info,
                'timestamp': datetime.now().isoformat()
            })
        else:
            emit('upload_status', {
                'upload_id': upload_id,
                'progress': None,
                'message': 'Upload bulunamadı',
                'timestamp': datetime.now().isoformat()
            })
            
    except Exception as e:
        emit('error', {
            'error': f'Status sorgu hatası: {str(e)}',
            'error_code': 'STATUS_ERROR'
        })


def broadcast_progress_update(upload_id, progress_data):
    """
    Broadcast progress update to all subscribed clients
    
    Args:
        upload_id: Upload identifier
        progress_data: Progress information
    """
    try:
        socketio.emit('upload_progress', {
            'upload_id': upload_id,
            'progress': progress_data,
            'timestamp': datetime.now().isoformat()
        }, room=f"upload_{upload_id}")
        
    except Exception as e:
        print(f"Broadcast error: {str(e)}")


def start_progress_monitor():
    """
    Background thread to monitor progress changes and broadcast updates
    """
    last_progress_state = {}
    
    while True:
        try:
            with progress_lock:
                current_progress = dict(progress_tracker)
            
            # Check for changes
            for upload_id, progress_data in current_progress.items():
                if (upload_id not in last_progress_state or 
                    last_progress_state[upload_id] != progress_data):
                    
                    # Broadcast update
                    broadcast_progress_update(upload_id, progress_data)
                    last_progress_state[upload_id] = progress_data
            
            # Clean up completed uploads after 5 minutes
            current_time = time.time()
            uploads_to_remove = []
            
            for upload_id, progress_data in current_progress.items():
                if progress_data.get('status') in ['completed', 'failed']:
                    started_at = progress_data.get('started_at')
                    if started_at:
                        try:
                            start_time = datetime.fromisoformat(started_at).timestamp()
                            if current_time - start_time > 300:  # 5 minutes
                                uploads_to_remove.append(upload_id)
                        except:
                            pass
            
            # Remove old uploads
            if uploads_to_remove:
                with progress_lock:
                    for upload_id in uploads_to_remove:
                        if upload_id in progress_tracker:
                            del progress_tracker[upload_id]
                        if upload_id in last_progress_state:
                            del last_progress_state[upload_id]
            
            time.sleep(1)  # Check every second
            
        except Exception as e:
            print(f"Progress monitor error: {str(e)}")
            time.sleep(5)  # Wait longer on error


# Start background progress monitor
progress_monitor_thread = threading.Thread(target=start_progress_monitor, daemon=True)
progress_monitor_thread.start()


@websocket_app.route('/websocket/health')
def websocket_health():
    """Health check endpoint for WebSocket server"""
    with clients_lock:
        client_count = len(connected_clients)
    
    with progress_lock:
        active_uploads = len([
            upload_id for upload_id, progress in progress_tracker.items()
            if progress.get('status') not in ['completed', 'failed']
        ])
    
    return {
        'status': 'healthy',
        'connected_clients': client_count,
        'active_uploads': active_uploads,
        'timestamp': datetime.now().isoformat()
    }


if __name__ == '__main__':
    print("🔌 WebSocket sunucusu başlatılıyor...")
    print("📡 WebSocket endpoint: ws://localhost:5506")
    socketio.run(websocket_app, host='0.0.0.0', port=5506, debug=True)