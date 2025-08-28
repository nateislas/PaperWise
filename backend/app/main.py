from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os
from typing import Optional
import aiofiles
import uuid

from app.routers import analysis, analyses
from app.config import settings

app = FastAPI(
    title="PaperWise API",
    description="AI-powered research paper analysis system",
    version="1.0.0"
)

# CORS middleware for frontend communication with streaming support
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=False,  # Must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(analyses.router, prefix="/api/v1")

# Serve uploaded files (including extracted figure images)
app.mount(
    "/uploads",
    StaticFiles(directory=settings.upload_dir),
    name="uploads",
)

@app.get("/")
async def root():
    return {"message": "PaperWise API - AI Research Paper Analysis"}

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "paperwise-api"}

@app.post("/api/v1/upload")
async def upload_paper(file: UploadFile = File(...)):
    """
    Upload a research paper PDF for analysis
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Check file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            status_code=400, 
            detail=f"File too large. Maximum size is {settings.max_file_size // (1024*1024)}MB"
        )
    
    # Create uploads directory if it doesn't exist
    upload_dir = settings.upload_dir
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    file_id = str(uuid.uuid4())
    filename = f"{file_id}_{file.filename}"
    file_path = os.path.join(upload_dir, filename)
    
    try:
        # Save the uploaded file
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        return {
            "file_id": file_id,
            "filename": file.filename,
            "message": "File uploaded successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=8000,
        # Performance optimizations
        workers=1,  # Single worker for streaming support
        loop="asyncio",
        http="httptools",  # Faster HTTP parser
        access_log=True,
        log_level="info",
        # Streaming optimizations
        timeout_keep_alive=30,
        timeout_graceful_shutdown=30
    )
