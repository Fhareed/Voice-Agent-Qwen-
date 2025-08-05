# Voice Agent

A multilingual voice-based AI assistant that uses speech recognition, retrieval-augmented generation (RAG), and text-to-speech to provide intelligent responses.

## Features

- **Multilingual Support**: English, Finnish, and Swedish
- **Speech Recognition**: Real-time audio transcription
- **RAG Pipeline**: Retrieval-augmented generation using indexed documents
- **Text-to-Speech**: Natural-sounding voice responses using ElevenLabs
- **Web Interface**: Simple browser-based UI for easy interaction

## Architecture

- **Backend**: FastAPI server handling audio processing and AI responses
- **Frontend**: HTML/JavaScript web interface for audio recording and playback
- **AI Pipeline**: LangChain + Ollama LLM + Custom RAG retriever

## Setup

### Prerequisites

- Python 3.8+
- Ollama with qwen:7b model installed
- ElevenLabs API key

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd Voice_Agent
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up Ollama:**
   ```bash
   ollama pull qwen:7b
   ```

4. **Configure API keys:**
   - Get your ElevenLabs API key from [ElevenLabs](https://elevenlabs.io/)
   - Update the API key in `app.py` (line 15) or set as environment variable

5. **Build RAG index (if needed):**
   ```bash
   python build_rag_index.py
   ```

## Usage

### Local Development

1. **Start the server:**
   ```bash
   uvicorn app:app --reload
   ```

2. **Open your browser:**
   Navigate to [http://localhost:8000](http://localhost:8000)

3. **Use the voice agent:**
   - Select your preferred language
   - Click "Record" to start speaking
   - Click "Stop" when done
   - Listen to the AI response

### Command Line Version

For direct command-line usage:
```bash
python voice_Agent.py
```

## Project Structure

```
Voice_Agent/
├── app.py                 # FastAPI backend
├── frontend.html          # Web interface
├── voice_Agent.py         # Command-line version
├── rag_retriever.py       # RAG pipeline
├── build_rag_index.py     # Index builder
├── document_loader.py     # Document processing
├── requirements.txt       # Python dependencies
├── README.md             # This file
├── rag_index/            # RAG index files
│   ├── index.faiss
│   └── index.pkl
└── example_docs/         # Sample documents
    ├── doc1.pdf
    ├── doc2.pdf
    └── doc3.pdf
```

## API Endpoints

- `GET /`: Serve the web interface
- `GET /health`: Health check endpoint
- `POST /ask`: Process audio and return AI response

## Deployment

### Environment Variables

For production, set these environment variables:
```bash
export ELEVENLABS_API_KEY="your-api-key"
export OLLAMA_HOST="your-ollama-host"
```

### Cloud Deployment

#### Render
1. Connect your GitHub repository
2. Set build command: `pip install -r requirements.txt`
3. Set start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Add environment variables

#### Railway
1. Connect your GitHub repository
2. Railway will auto-detect FastAPI
3. Add environment variables in dashboard

#### AWS/GCP/Azure
1. Deploy to a VM or container service
2. Set up reverse proxy (nginx)
3. Configure SSL certificates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]

## Acknowledgments

- ElevenLabs for text-to-speech
- Ollama for local LLM inference
- LangChain for AI pipeline orchestration 