# PaperWise Documentation

## Overview

PaperWise is an AI-powered research paper analysis system that provides comprehensive insights into research papers, going beyond simple summarization to offer the kind of analysis that PhD students and researchers need.

## Architecture

### Backend (Python/FastAPI)
- **Multi-Agent System**: Specialized AI agents for different aspects of analysis
- **PDF Processing**: Advanced PDF parsing with text, table, and figure extraction
- **Llama Integration**: Leveraging Meta's Llama models for intelligent analysis
- **RESTful API**: FastAPI-based endpoints for frontend communication

### Frontend (React/TypeScript)
- **Modern UI**: Clean, responsive interface with Tailwind CSS
- **Drag-and-Drop Upload**: Intuitive file upload experience
- **Real-time Analysis**: Live progress tracking and results display
- **Markdown Rendering**: Rich formatting for analysis results

## Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Llama API key

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:
   ```bash
   cp env.example .env
   # Edit .env and add your Llama API key
   ```

5. **Run the backend server**:
   ```bash
   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm start
   ```

The frontend will be available at `http://localhost:3000`

## API Endpoints

### File Upload
- `POST /api/v1/upload` - Upload a PDF file for analysis

### Analysis
- `POST /api/v1/analyze` - Comprehensive analysis using all agents
- `POST /api/v1/analyze/methodology` - Methodology-only analysis
- `POST /api/v1/analyze/results` - Results-only analysis
- `POST /api/v1/analyze/contextualization` - Contextualization-only analysis

### Health Check
- `GET /health` - API health status

## Agent System

### PDF Parser Agent
- Extracts text, tables, and figures from PDF files
- Identifies document sections (Abstract, Introduction, Methods, etc.)
- Creates structured document chunks for analysis

### Methodology Agent
- Analyzes experimental design and research methods
- Evaluates statistical approaches and sample sizes
- Identifies methodological strengths and limitations

### Results Agent
- Interprets research findings and statistical significance
- Extracts key results and their implications
- Assesses data quality and presentation

### Contextualization Agent
- Places research within broader academic context
- Identifies novelty and field contributions
- Suggests future research directions

### Orchestrator Agent
- Coordinates all specialized agents
- Synthesizes analyses into comprehensive reports
- Manages parallel processing for efficiency

## Usage

1. **Upload a PDF**: Drag and drop or click to upload a research paper
2. **Optional Query**: Add specific questions about the paper
3. **Analyze**: Click "Analyze Paper" to start the AI analysis
4. **Review Results**: View comprehensive analysis including:
   - Executive summary
   - Key insights
   - Detailed analysis
   - Recommendations for different stakeholders

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `LLAMA_API_KEY` | Your Llama API key | Required |
| `LLAMA_BASE_URL` | Llama API base URL | `https://api.llama.com/compat/v1/` |
| `LLAMA_MODEL` | Llama model to use | `Llama-4-Maverick-17B-128E-Instruct-FP8` |
| `LLAMA_TEMPERATURE` | Model temperature | `0.1` |
| `UPLOAD_DIR` | File upload directory | `uploads` |
| `MAX_FILE_SIZE` | Maximum file size (bytes) | `52428800` (50MB) |
| `CHUNK_SIZE` | Text chunk size for processing | `1000` |
| `CHUNK_OVERLAP` | Chunk overlap size | `200` |

## Development

### Adding New Agents

1. Create a new agent class inheriting from `BaseAgent`
2. Implement the required methods:
   - `_get_system_prompt()`: Define the agent's role
   - `analyze()`: Main analysis logic
3. Add the agent to the `OrchestratorAgent`
4. Create corresponding API endpoints

### Customizing Analysis

- Modify agent system prompts in their respective classes
- Adjust chunk sizes and overlap in configuration
- Add new analysis types by extending the orchestrator

## Troubleshooting

### Common Issues

1. **PDF Parsing Errors**: Ensure PDF is not password-protected or corrupted
2. **API Key Issues**: Verify Llama API key is valid and has sufficient credits
3. **Memory Issues**: Reduce chunk size for large documents
4. **Timeout Errors**: Increase timeout settings for complex analyses

### Logs

Check backend logs for detailed error information:
```bash
tail -f backend/logs/app.log
```

## Security Considerations

- Files are processed temporarily and not stored permanently
- API keys should be kept secure and not committed to version control
- Consider implementing rate limiting for production use
- Add authentication for multi-user environments

## Performance Optimization

- Use async processing for large files
- Implement caching for repeated analyses
- Consider using vector databases for similarity search
- Optimize chunk sizes based on document characteristics

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
