[//]: # (# TiDB AgentX MindFlow - Hackathon 2025)

[//]: # ()
[//]: # (**Advanced Multi-step AI Agent using Model Context Protocol &#40;MCP&#41; and TiDB Serverless**)

[//]: # ()
[//]: # (## 🎯 Project Overview)

[//]: # ()
[//]: # (This project demonstrates a sophisticated **multi-step AI agent** that leverages **TiDB Serverless vector search** and **Model Context Protocol &#40;MCP&#41;** to create intelligent document analysis and content research workflows. Built for the TiDB AgentX Hackathon 2025.)

[//]: # ()
[//]: # (### 🚀 Key Features)

[//]: # ()
[//]: # (- **Multi-Step Agentic Workflows**: 6+ step automated processes from input to final action)

[//]: # (- **TiDB Serverless Integration**: Native vector search with 1536-dimensional embeddings)

[//]: # (- **MCP Architecture**: Tool-based agent communication protocol)

[//]: # (- **Advanced AI Analysis**: OpenAI GPT-4 and embeddings integration)

[//]: # (- **Real-time Tracking**: Complete audit trail and workflow monitoring)

[//]: # (- **External Tool Integration**: Extensible API integrations &#40;Google Search, YouTube, etc.&#41;)

[//]: # (- **Production-Ready Architecture**: MVC pattern with comprehensive error handling)

[//]: # ()
[//]: # (## 🏗️ Architecture)

[//]: # ()
[//]: # (```)

[//]: # (┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐)

[//]: # (│   Web Interface │────│  Express API    │────│ Agent           │)

[//]: # (│   &#40;Frontend&#41;    │    │  &#40;Controllers&#41;  │    │ Orchestrator    │)

[//]: # (└─────────────────┘    └─────────────────┘    └─────────────────┘)

[//]: # (                                │                        │)

[//]: # (                                │                        │)

[//]: # (                       ┌─────────────────┐    ┌─────────────────┐)

[//]: # (                       │   Services      │    │   MCP Server    │)

[//]: # (                       │   &#40;Business&#41;    │────│   &#40;Tools&#41;       │)

[//]: # (                       └─────────────────┘    └─────────────────┘)

[//]: # (                                │                        │)

[//]: # (                                │                        │)

[//]: # (                       ┌─────────────────┐    ┌─────────────────┐)

[//]: # (                       │   Models        │    │   OpenAI API    │)

[//]: # (                       │   &#40;Database&#41;    │    │   &#40;LLM/Embed&#41;   │)

[//]: # (                       └─────────────────┘    └─────────────────┘)

[//]: # (                                │)

[//]: # (                                │)

[//]: # (                       ┌─────────────────┐)

[//]: # (                       │  TiDB Serverless│)

[//]: # (                       │  Vector Search  │)

[//]: # (                       └─────────────────┘)

[//]: # (```)

[//]: # ()
[//]: # (## 🎬 Demo Workflows)

[//]: # ()
[//]: # (### 1. Document Analysis Workflow)

[//]: # (```)

[//]: # (Input Document → Content Extraction → Vector Embedding → TiDB Storage )

[//]: # (                                          ↓)

[//]: # (Final Report ← AI Summarization ← Similar Documents ← Vector Search)

[//]: # (```)

[//]: # ()
[//]: # (### 2. Content Research Workflow  )

[//]: # (```)

[//]: # (Research Query → Document Search → Web Search &#40;Optional&#41; → Result Aggregation)

[//]: # (                                          ↓)

[//]: # (Research Report ← Knowledge Synthesis ← Content Analysis ← Source Validation)

[//]: # (```)

[//]: # ()
[//]: # (## 🚦 Quick Start)

[//]: # ()
[//]: # (### Prerequisites)

[//]: # (- **Node.js 18+**)

[//]: # (- **TiDB Cloud Account** &#40;configured&#41;)

[//]: # (- **OpenAI API Key** &#40;with credits&#41;)

[//]: # ()
[//]: # (### 1. Installation)

[//]: # (```bash)

[//]: # (git clone <repository>)

[//]: # (cd tidb-agentx-project)

[//]: # (npm install)

[//]: # (```)

[//]: # ()
[//]: # (### 2. Configuration)

[//]: # (```bash)

[//]: # (cp .env.example .env)

[//]: # (```)

[//]: # ()
[//]: # (Your `.env` is already configured with the provided credentials!)

[//]: # ()
[//]: # (### 3. Database Setup)

[//]: # (```bash)

[//]: # (npm run setup)

[//]: # (```)

[//]: # ()
[//]: # (### 4. Start Application)

[//]: # (```bash)

[//]: # (# Development mode)

[//]: # (npm run dev)

[//]: # ()
[//]: # (# Production mode  )

[//]: # (npm start)

[//]: # (```)

[//]: # ()
[//]: # (### 5. Access Points)

[//]: # (- **API**: http://localhost:3002/api)

[//]: # (- **Frontend**: http://localhost:3002/app)

[//]: # (- **Health**: http://localhost:3002/api/health)

[//]: # (- **Docs**: http://localhost:3002/api/docs)

[//]: # ()
[//]: # (## 🔧 API Endpoints)

[//]: # ()
[//]: # (### Document Operations)

[//]: # (```http)

[//]: # (POST   /api/documents/upload          # Upload document)

[//]: # (POST   /api/documents/process         # Process with AI agent)

[//]: # (GET    /api/documents/search          # Vector/text search)

[//]: # (POST   /api/documents/analyze         # AI analysis)

[//]: # (GET    /api/documents                 # List documents)

[//]: # (GET    /api/documents/stats           # Statistics)

[//]: # (```)

[//]: # ()
[//]: # (### Agent Workflows)

[//]: # (```http)

[//]: # (POST   /api/agent/analyze             # Document analysis workflow)

[//]: # (POST   /api/agent/research            # Content research workflow)

[//]: # (POST   /api/agent/demo                # Demo workflow)

[//]: # (GET    /api/agent/health              # Agent system health)

[//]: # (GET    /api/agent/sessions            # List sessions)

[//]: # (GET    /api/agent/stats               # Agent statistics)

[//]: # (```)

[//]: # ()
[//]: # (## 🎯 Multi-Step Workflows Demonstrated)

[//]: # ()
[//]: # (### Document Analysis &#40;6 Steps&#41;)

[//]: # (1. **Session Creation** - Initialize agent session)

[//]: # (2. **Document Ingestion** - Process and embed content )

[//]: # (3. **Vector Search** - Find similar documents in TiDB)

[//]: # (4. **LLM Analysis** - Generate comprehensive analysis)

[//]: # (5. **Insight Extraction** - Extract key findings)

[//]: # (6. **Report Generation** - Create final workflow report)

[//]: # ()
[//]: # (### Content Research &#40;5 Steps&#41;)

[//]: # (1. **Query Processing** - Parse research request)

[//]: # (2. **Document Search** - TiDB vector search)

[//]: # (3. **External Search** - Web/API integrations &#40;optional&#41;)

[//]: # (4. **Result Synthesis** - Combine multi-source data)

[//]: # (5. **Research Report** - Generate findings document)

[//]: # ()
[//]: # (## 🛠️ MCP Tools Available)

[//]: # ()
[//]: # (| Tool | Description | Usage |)

[//]: # (|------|-------------|--------|)

[//]: # (| `ingest_document` | Process documents with embeddings | Document upload/processing |)

[//]: # (| `vector_search` | Semantic search in TiDB | Find similar content |)

[//]: # (| `analyze_documents` | AI-powered analysis | Generate insights |)

[//]: # (| `extract_insights` | Key point extraction | Content summarization |)

[//]: # (| `log_action` | Audit trail logging | Workflow tracking |)

[//]: # (| `create_session` | Session management | Workflow orchestration |)

[//]: # (| `search_web` | External web search | Research expansion |)

[//]: # (| `youtube_transcript` | Video transcript extraction | Media processing |)

[//]: # ()
[//]: # (## 📊 Database Schema)

[//]: # ()
[//]: # (### Documents Table)

[//]: # (- Vector embeddings &#40;1536 dimensions&#41;)

[//]: # (- Content with metadata)

[//]: # (- Source tracking &#40;upload, web, youtube, notion&#41;)

[//]: # (- Status management &#40;processing, completed, failed&#41;)

[//]: # ()
[//]: # (### Agent Sessions)

[//]: # (- Workflow tracking)

[//]: # (- Progress monitoring  )

[//]: # (- Session management)

[//]: # ()
[//]: # (### Action Logs)

[//]: # (- Complete audit trail)

[//]: # (- Performance metrics)

[//]: # (- Error tracking)

[//]: # ()
[//]: # (## 🎪 Demo Instructions)

[//]: # ()
[//]: # (### For Hackathon Judges)

[//]: # ()
[//]: # (1. **Start the application**:)

[//]: # (   ```bash)

[//]: # (   npm start)

[//]: # (   ```)

[//]: # ()
[//]: # (2. **Access the demo interface**: )

[//]: # (   Navigate to http://localhost:3002/app)

[//]: # ()
[//]: # (3. **Run automated demo**:)

[//]: # (   ```bash)

[//]: # (   curl -X POST http://localhost:3002/api/agent/demo \)

[//]: # (     -H "Content-Type: application/json" \)

[//]: # (     -d '{"scenario": "basic"}')

[//]: # (   ```)

[//]: # ()
[//]: # (4. **Test document upload**:)

[//]: # (   - Use the web interface at `/app`)

[//]: # (   - Upload a PDF or text document)

[//]: # (   - Watch the multi-step workflow execute)

[//]: # ()
[//]: # (5. **View workflow logs**:)

[//]: # (   - Check `/api/agent/sessions` for session tracking)

[//]: # (   - Review `/api/agent/stats` for system statistics)

[//]: # ()
[//]: # (## 📈 Hackathon Submission Checklist)

[//]: # ()
[//]: # (- ✅ **Multi-step agentic workflow** &#40;6+ automated steps&#41;)

[//]: # (- ✅ **TiDB Serverless integration** &#40;vector search, embeddings&#41;)

[//]: # (- ✅ **MCP architecture** &#40;tool-based communication&#41;)

[//]: # (- ✅ **External tool integration** &#40;OpenAI, extensible APIs&#41;)

[//]: # (- ✅ **Real-world application** &#40;document analysis, research&#41;)

[//]: # (- ✅ **Complete audit trail** &#40;session tracking, action logs&#41;)

[//]: # (- ✅ **Production-ready code** &#40;error handling, validation&#41;)

[//]: # (- ✅ **Comprehensive documentation** &#40;API docs, workflows&#41;)

[//]: # ()
[//]: # (## 🔍 Technical Highlights)

[//]: # ()
[//]: # (### Advanced Features)

[//]: # (- **Sophisticated Error Handling**: Comprehensive middleware stack)

[//]: # (- **Input Validation**: Schema-based request validation)

[//]: # (- **Rate Limiting**: Protection against API abuse  )

[//]: # (- **Comprehensive Logging**: Winston-based logging system)

[//]: # (- **Security**: Helmet.js, CORS, input sanitization)

[//]: # (- **Performance**: Compression, efficient database queries)

[//]: # (- **Extensibility**: Plugin-based MCP tool architecture)

[//]: # ()
[//]: # (### AI Integration)

[//]: # (- **OpenAI Embeddings**: text-embedding-ada-002 &#40;1536 dimensions&#41;)

[//]: # (- **GPT-4 Analysis**: Context-aware document analysis)

[//]: # (- **Vector Similarity**: Cosine distance in TiDB)

[//]: # (- **Hybrid Search**: Combined vector + full-text search)

[//]: # ()
[//]: # (### Database Integration)

[//]: # (- **TiDB Serverless**: Cloud-native MySQL-compatible database)

[//]: # (- **Vector Indexing**: Native vector search capabilities)

[//]: # (- **ACID Transactions**: Reliable data consistency)

[//]: # (- **Schema Migration**: Automated database setup)

[//]: # ()
[//]: # (## 📝 Project Structure)

[//]: # ()
[//]: # (```)

[//]: # (tidb-agentx-project/)

[//]: # (├── src/)

[//]: # (│   ├── config/          # Configuration management)

[//]: # (│   ├── controllers/     # API controllers)

[//]: # (│   ├── services/        # Business logic)

[//]: # (│   ├── models/         # Database models)

[//]: # (│   ├── middleware/     # Express middleware)

[//]: # (│   ├── mcp/            # MCP server & tools)

[//]: # (│   ├── routes/         # API routes)

[//]: # (│   ├── utils/          # Utilities)

[//]: # (│   └── app.js          # Main application)

[//]: # (├── public/             # Frontend files)

[//]: # (├── uploads/            # File uploads)

[//]: # (├── logs/               # Application logs)

[//]: # (├── package.json)

[//]: # (├── .env.example)

[//]: # (└── README.md)

[//]: # (```)

[//]: # ()
[//]: # (## 🤝 Contributing)

[//]: # ()
[//]: # (This is a hackathon project, but contributions and improvements are welcome!)

[//]: # ()
[//]: # (## 📄 License)

[//]: # ()
[//]: # (MIT License - Built for TiDB AgentX Hackathon 2025)

[//]: # ()
[//]: # (## 🏆 Hackathon Submission)

[//]: # ()
[//]: # (**Team**: Eduard  )

[//]: # (**Email**: [Your TiDB Cloud account email]  )

[//]: # (**Repository**: Public &#40;or access granted to hackathon-judge@pingcap.com&#41;  )

[//]: # (**Demo Video**: [To be recorded - showing complete multi-step workflow])

[//]: # ()
[//]: # (---)

[//]: # ()
[//]: # (**Built with ❤️ for TiDB AgentX Hackathon 2025**)