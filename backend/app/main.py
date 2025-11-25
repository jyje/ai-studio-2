from fastapi import FastAPI, Body, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI
from typing import Optional
import json
from app.config import LLM_API_BASE_URL, LLM_API_KEY, LLM_MODEL_NAME

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

# API client
client = OpenAI(
    base_url=LLM_API_BASE_URL,
    api_key=LLM_API_KEY
)

@app.get('/')
def read_root():
    return {'Hello': 'World'}

@app.get('/v2/info')
def get_info():
    """Get model and agent information"""
    return {
        'model': LLM_MODEL_NAME,
        'agent': 'AI Studio 2.0'
    }

async def stream_chat_response(user_message: str, request: Request):
    """Stream chat response in SSE format with client disconnect detection"""
    try:
        # Send start event
        yield "event: start\n"
        yield f"data: {json.dumps({'status': 'started'})}\n\n"
        
        stream = client.chat.completions.create(
            model=LLM_MODEL_NAME,
            messages=[
                {"role": "user", "content": user_message}
            ],
            stream=True
        )
        
        for chunk in stream:
            # Check if client disconnected
            if await request.is_disconnected():
                break
            
            if chunk.choices and len(chunk.choices) > 0:
                delta = chunk.choices[0].delta
                if delta and delta.content:
                    # Send data in SSE format: data: {content}\n\n
                    # JSON-encode the content to handle special characters
                    content_json = json.dumps(delta.content)
                    yield f"data: {content_json}\n\n"
        
        # Send end event only if not disconnected
        if not await request.is_disconnected():
            yield "event: end\n"
            yield f"data: {json.dumps({'status': 'completed'})}\n\n"
    except GeneratorExit:
        # Client disconnected - stop yielding
        return
    except Exception as e:
        # Send error event only if client is still connected
        if not await request.is_disconnected():
            error_data = json.dumps({"error": str(e)})
            yield f"event: error\n"
            yield f"data: {error_data}\n\n"

@app.post('/v2/chat')
async def chat(request: Request, body: Optional[dict] = Body(None)):
    if not body or 'message' not in body:
        return {'error': 'message field is required'}, 400
    
    user_message = body['message']
    return StreamingResponse(
        stream_chat_response(user_message, request),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',  # Disable buffering for nginx
        }
    )
